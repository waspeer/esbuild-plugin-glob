// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path = "./lowest-common-ancestor.d.ts" />

import chokidar from 'chokidar';
import * as esbuild from 'esbuild';
import fs from 'fs';
import { lowestCommonAncestor } from 'lowest-common-ancestor';
import match from 'minimatch';
import path from 'path';
import glob from 'tiny-glob';
import invariant from 'tiny-invariant';

interface GlobPluginOptions<TControls extends boolean> {
  chokidarOptions?: chokidar.WatchOptions;
  /** Setting this to true returns a tuple with the plugin and a controls object */
  controls?: TControls;
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
}: GlobPluginOptions<TControls> = {}): ReturnValue<TControls> {
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
      if (!Array.isArray(build.initialOptions.entryPoints)) {
        throw new TypeError('GlobPlugin currently only supports array entrypoints');
      }

      const resolvedEntryPoints = (
        await Promise.all(
          build.initialOptions.entryPoints.map((entryPoint) =>
            glob(entryPoint, { cwd: build.initialOptions.absWorkingDir, filesOnly: true }),
          ),
        )
      ).flat();

      // Watch mode
      if (build.initialOptions.watch) {
        const entryGlobs = build.initialOptions.entryPoints;
        const watcher = chokidar.watch(entryGlobs, {
          cwd: build.initialOptions.absWorkingDir,
          ...chokidarOptions,
        });

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
          // Calculate the lowest common ancestor or esbuild will incorrectly
          // determine it from the single entrypoint that is added/changed.
          // @see https://esbuild.github.io/api/#outbase
          outbase: build.initialOptions.outbase || lowestCommonAncestor(...resolvedEntryPoints),
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
                .map((input) => normalizePath(input, build.initialOptions.absWorkingDir)),
            );

          watcher.add(inputs);

          entryToInputsMap.set(entry, inputs);
          entryToOutputsMap.set(entry, outputs);
          entryToBuildResultMap.set(entry, buildResult);

          onRebuild?.(null, buildResult);
        };

        // Find the entries by the input path
        const findEntriesByInput = (input: string): string[] => {
          // eslint-disable-next-line unicorn/prefer-spread
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

            console.log('[add]', addedPath);

            const buildResult = await esbuild.build({
              ...sharedOptions,
              entryPoints: [addedPath],
            });

            handleBuildResult(addedPath, buildResult);
          })
          .on('change', async (changedPath) => {
            const entries = findEntriesByInput(changedPath);

            entries.forEach(async (entry) => {
              console.log('[change]', entry);

              const oldResult = entryToBuildResultMap.get(entry);

              invariant(oldResult?.rebuild, 'Expected all build results to be incremental');
              const newResult = await oldResult.rebuild();

              handleBuildResult(entry, newResult);
            });
          })
          .on('unlink', async (unlinkedPath) => {
            if (build.initialOptions.write === false) return;

            const outputPaths = entryToOutputsMap.get(unlinkedPath);

            if (outputPaths) {
              console.log('[unlink]', unlinkedPath);
              outputPaths.forEach((outputPath) => fs.unlinkSync(outputPath));
            }
          });
      } else {
        build.initialOptions.entryPoints = resolvedEntryPoints;
      }
    },
  };

  return (controls ? [plugin, controlFunctions] : plugin) as any;
}

// UTILITIES
// ---------

function normalizePath(filePath: string, cwd: string = process.cwd()): string {
  return path.relative(cwd, filePath.replace(/^(\w+:)/, ''));
}

export { globPlugin };
