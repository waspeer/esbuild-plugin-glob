import chokidar from 'chokidar';
import * as esbuild from 'esbuild';
import fs from 'fs';
import match from 'minimatch';
import path from 'path';
import glob from 'tiny-glob';
import invariant from 'tiny-invariant';

interface GlobPluginOptions<TControls extends boolean> {
  chokidarOptions?: chokidar.WatchOptions;
  /** Setting this to true returns a tuple with the plugin and a controls object */
  controls?: TControls;
  /** Disables all logging */
  silent?: boolean;
  additionalEntrypoints?: string[];
}

interface GlobPluginControls {
  /** Stops watching if in watch mode */
  stopWatching: () => Promise<void>;
}

type ReturnValue<TControls extends boolean> = TControls extends true
  ? [esbuild.Plugin, GlobPluginControls]
  : esbuild.Plugin;

function globPlugin<TControls extends boolean = false>({
  chokidarOptions,
  controls,
  silent = false,
  additionalEntrypoints = [],
}: GlobPluginOptions<TControls> = {}): ReturnValue<TControls> {
  const log = createLogger(silent);

  const context = {
    watcher: undefined as chokidar.FSWatcher | undefined,
  };

  const controlFunctions: GlobPluginControls = {
    async stopWatching() {
      if (!context.watcher) return;
      await context.watcher.close();
    },
  };

  const plugin: esbuild.Plugin = {
    name: 'glob',
    async setup(build) {
      if (
        !Array.isArray(build.initialOptions.entryPoints) ||
        !Array.isArray(additionalEntrypoints)
      ) {
        throw new TypeError('GlobPlugin currently only supports array entrypoints');
      }

      // Watch mode
      if (build.initialOptions.watch) {
        const entryGlobs = [...build.initialOptions.entryPoints, ...additionalEntrypoints];
        const watcher = chokidar.watch(entryGlobs, chokidarOptions);

        context.watcher = watcher;

        // AUGMENT OPTIONS
        // ---------------
        // Plugin takes care of running the build, so disable initial run by overriding entryPoints
        build.initialOptions.entryPoints = undefined;

        // Plugin takes care of watching fs, so disable esbuild watch
        const onRebuild =
          typeof build.initialOptions.watch === 'object'
            ? build.initialOptions.watch.onRebuild
            : undefined;
        build.initialOptions.watch = false;

        // Plugin relies on incremental and metafile options
        const sharedOptions = {
          ...build.initialOptions,
          incremental: true,
          metafile: true,
        };

        // MAPS
        // ----
        const entryToInputsMap: Map<string, string[]> = new Map();
        const entryToBuildResultMap: Map<string, esbuild.BuildResult> = new Map();
        const entryToOutputsMap: Map<string, string[]> = new Map();

        // UTILITY FUNCTIONS
        // -----------------
        // Test if the provided path matches the entry globs
        const matchesGlobs = (filePath: string): boolean => {
          return entryGlobs.some((glob) => match(filePath, glob));
        };

        // Parse the build result and update watcher and maps
        const handleBuildResult = async (
          entry: string,
          buildResult: esbuild.BuildResult,
        ): Promise<void> => {
          invariant(watcher);
          invariant(buildResult.metafile, 'Expected metafile to be created');

          const outputs = Object.keys(buildResult.metafile.outputs);
          const inputs = Object.values(buildResult.metafile.outputs)
            .filter((output) => !!output.entryPoint)
            .flatMap((output) =>
              Object.keys(output.inputs)
                .filter((input) => !input.includes('node_modules'))
                .map((input) => normalizePath(input)),
            );

          watcher.add(inputs);

          entryToInputsMap.set(entry, inputs);
          entryToOutputsMap.set(entry, outputs);
          entryToBuildResultMap.set(entry, buildResult);

          onRebuild?.(null, buildResult);
        };

        // Find the entries by the input path
        const findEntriesByInput = (input: string): string[] => {
          return (
            [...entryToInputsMap.entries()]
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              .filter(([_entry, inputs]) => inputs.includes(input))
              .map(([entry]) => entry)
          );
        };

        // WATCH
        // -----
        watcher
          .on('add', async (addedPath) => {
            if (!matchesGlobs(addedPath)) return;

            log('[add]', addedPath);

            const buildResult = await esbuild.build({
              ...sharedOptions,
              entryPoints: [addedPath],
            });

            handleBuildResult(addedPath, buildResult);
          })
          .on('change', async (changedPath) => {
            const entries = findEntriesByInput(changedPath);

            entries.forEach(async (entry) => {
              log('[change]', entry);

              const oldResult = entryToBuildResultMap.get(entry);

              try {
                invariant(oldResult?.rebuild, 'Expected all build results to be incremental');
                handleBuildResult(entry, await oldResult.rebuild());
              } catch {
                //? Error is ignored, because esbuild handles logging of build errors already
              }
            });
          })
          .on('unlink', async (unlinkedPath) => {
            if (build.initialOptions.write === false) return;

            const outputPaths = entryToOutputsMap.get(unlinkedPath);

            if (outputPaths) {
              log('[unlink]', unlinkedPath);
              outputPaths.forEach((outputPath) => fs.unlinkSync(outputPath));
            }
          });
      } else {
        const entryGlobs = [...build.initialOptions.entryPoints, ...additionalEntrypoints];
        const resolvedEntryPoints = await Promise.all(
          entryGlobs.map((entryPoint) => glob(entryPoint)),
        ).then((nestedEntryPoints) => nestedEntryPoints.flat());
        build.initialOptions.entryPoints = resolvedEntryPoints;
      }
    },
  };

  return (controls ? [plugin, controlFunctions] : plugin) as any;
}

// UTILITIES
// ---------

function createLogger(silent: boolean) {
  return (...arguments_: Parameters<typeof console.log>) => {
    if (!silent) console.log(...arguments_);
  };
}

function normalizePath(filePath: string): string {
  return path.relative(process.cwd(), filePath.replace(/^(\w+:)/, ''));
}

export { globPlugin };
