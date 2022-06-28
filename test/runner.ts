import untypedTest from 'ava';
import del from 'del';
import * as esbuild from 'esbuild';
import { promises as fs } from 'fs';
import path from 'path';

import type { ExecutionContext, ImplementationFn, TestFn } from 'ava';

import { globPlugin } from '../src';
import {
  ADDITIONAL_IN_DIR_NAME,
  DEPENDENCY_DIR_NAME,
  FILE_DIR,
  IN_DIR_NAME,
  OUT_DIR_NAME,
} from './constants';
import { randomString, wait } from './util';

interface TestContext {
  /** Triggers a build */
  build: () => void;
  /** Unique directory for current test */
  directory: string;
}

const test = untypedTest as TestFn<TestContext>;

function runner(
  testFunction: ImplementationFn<unknown[], TestContext>,
  {
    watchMode = true,
    additionalEntrypoints = [],
  }: { watchMode?: boolean; additionalEntrypoints?: string[] } = {},
): ImplementationFn<unknown[], TestContext> {
  return async (t: ExecutionContext<TestContext>) => {
    const directoryName = randomString();
    const directory = path.resolve(FILE_DIR, directoryName);

    const inputDirectory = path.resolve(directory, IN_DIR_NAME);
    const additionalInputDirectory = path.resolve(directory, ADDITIONAL_IN_DIR_NAME);
    const outputDirectory = path.resolve(directory, OUT_DIR_NAME);
    const dependencyDirectory = path.resolve(directory, DEPENDENCY_DIR_NAME);

    // Prepare
    await Promise.all([
      fs.mkdir(inputDirectory, { recursive: true }),
      fs.mkdir(additionalInputDirectory, { recursive: true }),
      fs.mkdir(outputDirectory, { recursive: true }),
      fs.mkdir(dependencyDirectory, { recursive: true }),
    ]);

    const [plugin, pluginControls] = globPlugin({
      controls: true,
      additionalEntrypoints,
    });

    function build() {
      const globPath = path.relative(process.cwd(), path.resolve(inputDirectory, '**/*'));

      esbuild.build({
        bundle: true,
        entryPoints: [globPath.replace(/\\/g, '/')],
        plugins: [plugin],
        outdir: outputDirectory,
        watch: watchMode,
      });
    }

    if (watchMode) {
      build();
      await wait();
    }

    t.context.build = build;
    t.context.directory = directory;

    // Test
    await (async () => {
      await testFunction(t);
    })().finally(async () => {
      // Teardown
      await pluginControls.stopWatching();
      await del(directory);
    });
  };
}

export { test, runner };
