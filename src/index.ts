import chokidar from 'chokidar';
import esbuild from 'esbuild';
import fs from 'fs';
import match from 'minimatch';
import path from 'path';
import glob from 'tiny-glob';
import invariant from 'tiny-invariant';

function globPlugin(): esbuild.Plugin {
  return {
    name: 'glob',
    async setup(build) {
      if (!Array.isArray(build.initialOptions.entryPoints)) {
        throw new Error('GlobPlugin currently only supports array entrypoints');
      }

      // Watch mode
      if (!!build.initialOptions.watch) {
        const entryGlobs = build.initialOptions.entryPoints;
        const watcher = chokidar.watch(entryGlobs);

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
        const entryToBuildResultMap: Map<
          string,
          esbuild.BuildResult
        > = new Map();
        const entryToOutputsMap: Map<string, string[]> = new Map();

        // UTILITY FUNCTIONS
        // -----------------
        // Test if the provided path matches the entry globs
        const matchesGlobs = (filePath: string): boolean => {
          return entryGlobs.some(glob => match(filePath, glob));
        };

        // Parse the build result and update watcher and maps
        const handleBuildResult = async (
          entry: string,
          buildResult: esbuild.BuildResult
        ): Promise<void> => {
          invariant(buildResult.metafile, 'Expected metafile to be created');

          const outputs = Object.keys(buildResult.metafile.outputs);
          const inputs = Object.values(buildResult.metafile.outputs)
            .filter(output => !!output.entryPoint)
            .flatMap(output =>
              Object.keys(output.inputs)
                .filter(input => !input.includes('node_modules'))
                .map(input => normalizePath(input))
            );

          watcher.add(inputs);

          entryToInputsMap.set(entry, inputs);
          entryToOutputsMap.set(entry, outputs);
          entryToBuildResultMap.set(entry, buildResult);

          onRebuild?.(null, buildResult);
        };

        // Find the entries by the input path
        const findEntriesByInput = (input: string): string[] => {
          return Array.from(entryToInputsMap.entries())
            .filter(([_entry, inputs]) => inputs.includes(input))
            .map(([entry]) => entry);
        };

        // WATCH
        // -----
        watcher
          .on('add', async addedPath => {
            if (!matchesGlobs(addedPath)) return;

            console.log('[add]', addedPath);

            const buildResult = await esbuild.build({
              ...sharedOptions,
              entryPoints: [addedPath],
            });

            handleBuildResult(addedPath, buildResult);
          })
          .on('change', async changedPath => {
            const entries = findEntriesByInput(changedPath);

            entries.forEach(async entry => {
              console.log('[change]', entry);

              const oldResult = entryToBuildResultMap.get(entry);

              invariant(
                oldResult?.rebuild,
                'Expected all build results to be incremental'
              );
              const newResult = await oldResult.rebuild();

              handleBuildResult(entry, newResult);
            });
          })
          .on('unlink', async unlinkedPath => {
            if (!build.initialOptions.write) return;

            const outputPaths = entryToOutputsMap.get(unlinkedPath);

            if (outputPaths) {
              console.log('[unlink]', unlinkedPath);
              outputPaths.forEach(outputPath => fs.unlinkSync(outputPath));
            }
          });
      } else {
        const resolvedEntryPoints = (
          await Promise.all(
            build.initialOptions.entryPoints.map(entryPoint => glob(entryPoint))
          )
        ).flat();
        build.initialOptions.entryPoints = resolvedEntryPoints;
      }
    },
  };
}

// UTILITIES
// ---------

function normalizePath(filePath: string): string {
  return path.relative(process.cwd(), filePath.replace(/^(\w+:)/, ''));
}

export { globPlugin };
