import untypedTest from 'ava';
import del from 'del';
import * as esbuild from 'esbuild';
import { promises as fs } from 'fs';
import path from 'path';

import type { GlobPluginControls, GlobPluginOptions } from '../../src';
import type { ExecutionContext, ImplementationFn, TestFn } from 'ava';

import { globPlugin } from '../../src';
import { DEPENDENCY_DIR_NAME, FILE_DIR, IN_DIR_NAME, OUT_DIR_NAME } from './constants';
import { randomString, wait } from './util';

interface TestContext {
  /** Triggers a build */
  build: (options?: {
    entryPoints?: string[];
    pluginOptions?: GlobPluginOptions<true>;
    watchMode?: boolean;
    silent?: boolean;
  }) => Promise<void>;
  /** Unique directory for current test */
  directory: string;
}

const test = untypedTest as TestFn<TestContext>;

function runner(
  testFunction: ImplementationFn<unknown[], TestContext>,
): ImplementationFn<unknown[], TestContext> {
  return async (t: ExecutionContext<TestContext>) => {
    const directoryName = randomString();
    const directory = path.resolve(FILE_DIR, directoryName);

    const inputDirectory = path.resolve(directory, IN_DIR_NAME);
    const outputDirectory = path.resolve(directory, OUT_DIR_NAME);
    const dependencyDirectory = path.resolve(directory, DEPENDENCY_DIR_NAME);

    // Will be defined when the build function is run inside the test
    let pluginControls: GlobPluginControls | undefined;

    await Promise.all([
      fs.mkdir(inputDirectory, { recursive: true }),
      fs.mkdir(outputDirectory, { recursive: true }),
      fs.mkdir(dependencyDirectory, { recursive: true }),
    ]);

    async function build({
      entryPoints = ['**/*'],
      pluginOptions = {} as GlobPluginOptions<true>,
      watchMode = true,
      silent = true,
    } = {}) {
      let plugin: esbuild.Plugin;

      // Resolve both entryPoints and additionalEntryPoints to the input directory
      const [resolvedEntryPoints, resolvedAdditionalEntryPoints] = [
        entryPoints,
        pluginOptions.additionalEntrypoints,
      ].map((relativeEntryPoints) =>
        relativeEntryPoints?.map((relativeEntryPoint) => {
          const isNegative = relativeEntryPoint.startsWith('!');
          const entryPoint = path
            .relative(
              process.cwd(),
              path.resolve(inputDirectory, relativeEntryPoint.slice(isNegative ? 1 : 0)),
            )
            .replace(/\\/g, '/');

          return isNegative ? `!${entryPoint}` : entryPoint;
        }),
      );

      [plugin, pluginControls] = globPlugin({
        silent,
        ...pluginOptions,
        additionalEntrypoints: resolvedAdditionalEntryPoints,
        controls: true,
      });

      esbuild.build({
        bundle: true,
        entryPoints: resolvedEntryPoints,
        plugins: [plugin],
        outdir: outputDirectory,
        watch: watchMode,
      });

      if (watchMode) {
        // Esbuild needs some time
        await wait();
      }
    }

    t.context.build = build;
    t.context.directory = directory;

    // Unfortunately testFunction is not a real promise, hence this iife
    await (async () => {
      await testFunction(t);
    })().finally(async () => {
      await pluginControls?.stopWatching();
      await del(directory);
    });
  };
}

export { test, runner };
