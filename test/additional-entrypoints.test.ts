import del from 'del';
import * as esbuild from 'esbuild';
import { existsSync } from 'fs';
import { promises as fs } from 'fs';
import { nanoid } from 'nanoid';
import path from 'path';

import { globPlugin } from '../src';
import { FILE_DIR, IN_DIR_NAME, ADDITIONAL_IN_DIR_NAME, OUT_DIR_NAME } from './constants';
import { AdditionalEntryFile } from './entryfile';
import { test } from './runner';
import { createEntryFile, retryAssertion } from './util';

test('the plugin resolves a single additionalEntrypoint specified explicitly via plugin option', async (t) => {
  const directoryName = nanoid();
  const directory = path.resolve(FILE_DIR, directoryName);

  const additionalInputDirectory = path.resolve(directory, ADDITIONAL_IN_DIR_NAME);
  const outputDirectory = path.resolve(directory, OUT_DIR_NAME);

  // Prepare
  await Promise.all([
    fs.mkdir(additionalInputDirectory, { recursive: true }),
    fs.mkdir(outputDirectory, { recursive: true }),
  ]);

  const additionalEntryfile = new AdditionalEntryFile({ directory });
  await additionalEntryfile.write();

  const [esbuildGlobPlugin] = globPlugin({
    controls: true,
    additionalEntrypoints: [additionalEntryfile.path],
  });

  await esbuild.build({
    bundle: true,
    entryPoints: [], // no entrypoints specified at esbuild build script
    plugins: [esbuildGlobPlugin],
    outdir: outputDirectory,
  });

  await retryAssertion(t, (tt) => {
    tt.true(existsSync(additionalEntryfile.outputPath));
  });

  await del(directory);
});

test('the plugin resolves multiple additionalEntrypoints specified as a glob via plugin option', async (t) => {
  const directoryName = nanoid();
  const directory = path.resolve(FILE_DIR, directoryName);

  const additionalInputDirectory = path.resolve(directory, ADDITIONAL_IN_DIR_NAME);
  const outputDirectory = path.resolve(directory, OUT_DIR_NAME);

  // Prepare
  await Promise.all([
    fs.mkdir(additionalInputDirectory, { recursive: true }),
    fs.mkdir(outputDirectory, { recursive: true }),
  ]);

  const additionalEntryfile1 = new AdditionalEntryFile({ directory });
  await additionalEntryfile1.write();
  const additionalEntryfile2 = new AdditionalEntryFile({ directory });
  await additionalEntryfile2.write();

  const additionalInputFilesGlob = path
    .relative(process.cwd(), path.resolve(additionalInputDirectory, '**/*'))
    .replace(/\\/g, '/');

  const [esbuildGlobPlugin] = globPlugin({
    controls: true,
    additionalEntrypoints: [additionalInputFilesGlob],
  });

  await esbuild.build({
    bundle: true,
    entryPoints: [], // no entrypoints specified at esbuild build script
    plugins: [esbuildGlobPlugin],
    outdir: outputDirectory,
  });

  await retryAssertion(t, (tt) => {
    tt.true(existsSync(additionalEntryfile1.outputPath));
    tt.true(existsSync(additionalEntryfile2.outputPath));
  });

  await del(directory);
});

test('the plugin resolves a single additionalEntrypoint specified explicitly via plugin option and merges it with files resolved with esbuild entryPoints glob', async (t) => {
  const directoryName = nanoid();
  const directory = path.resolve(FILE_DIR, directoryName);

  const inputDirectory = path.resolve(directory, IN_DIR_NAME);
  const additionalInputDirectory = path.resolve(directory, ADDITIONAL_IN_DIR_NAME);
  const outputDirectory = path.resolve(directory, OUT_DIR_NAME);

  // Prepare
  await Promise.all([
    fs.mkdir(inputDirectory, { recursive: true }),
    fs.mkdir(additionalInputDirectory, { recursive: true }),
    fs.mkdir(outputDirectory, { recursive: true }),
  ]);

  const entryFile1 = await createEntryFile({ directory });
  const entryFile2 = await createEntryFile({ directory });
  const additionalEntryfile = new AdditionalEntryFile({ directory });
  await additionalEntryfile.write();

  const [esbuildGlobPlugin] = globPlugin({
    controls: true,
    additionalEntrypoints: [additionalEntryfile.path],
  });

  const inputDirectoryGlobPath = path
    .relative(process.cwd(), path.resolve(inputDirectory, '**/*'))
    .replace(/\\/g, '/');

  await esbuild.build({
    bundle: true,
    entryPoints: [inputDirectoryGlobPath],
    plugins: [esbuildGlobPlugin],
    outdir: outputDirectory,
  });

  const entryFile1OutputPath = path.resolve(outputDirectory, IN_DIR_NAME, `${entryFile1.name}.js`);
  const entryFile2OutputPath = path.resolve(outputDirectory, IN_DIR_NAME, `${entryFile2.name}.js`);
  const additionalEntryfileOutputPath = path.resolve(
    outputDirectory,
    ADDITIONAL_IN_DIR_NAME,
    `${additionalEntryfile.name}.js`,
  );

  await retryAssertion(t, (tt) => {
    tt.true(existsSync(entryFile1OutputPath));
    tt.true(existsSync(entryFile2OutputPath));
    tt.true(existsSync(additionalEntryfileOutputPath));
  });

  await del(directory);
});

test('the plugin resolves multiple additionalEntrypoints specified as a glob via plugin option and merges them with files resolved with esbuild entryPoints glob', async (t) => {
  const directoryName = nanoid();
  const directory = path.resolve(FILE_DIR, directoryName);

  const inputDirectory = path.resolve(directory, IN_DIR_NAME);
  const additionalInputDirectory = path.resolve(directory, ADDITIONAL_IN_DIR_NAME);
  const outputDirectory = path.resolve(directory, OUT_DIR_NAME);

  // Prepare
  await Promise.all([
    fs.mkdir(inputDirectory, { recursive: true }),
    fs.mkdir(additionalInputDirectory, { recursive: true }),
    fs.mkdir(outputDirectory, { recursive: true }),
  ]);

  const entryFile1 = await createEntryFile({ directory });
  const entryFile2 = await createEntryFile({ directory });

  const additionalEntryfile1 = new AdditionalEntryFile({ directory });
  await additionalEntryfile1.write();
  const additionalEntryfile2 = new AdditionalEntryFile({ directory });
  await additionalEntryfile2.write();

  const additionalInputFilesGlob = path
    .relative(process.cwd(), path.resolve(additionalInputDirectory, '**/*'))
    .replace(/\\/g, '/');

  const inputDirectoryGlobPath = path
    .relative(process.cwd(), path.resolve(inputDirectory, '**/*'))
    .replace(/\\/g, '/');

  const [esbuildGlobPlugin] = globPlugin({
    controls: true,
    additionalEntrypoints: [additionalInputFilesGlob],
  });

  await esbuild.build({
    bundle: true,
    entryPoints: [inputDirectoryGlobPath],
    plugins: [esbuildGlobPlugin],
    outdir: outputDirectory,
  });

  const entryFile1OutputPath = path.resolve(outputDirectory, IN_DIR_NAME, `${entryFile1.name}.js`);
  const entryFile2OutputPath = path.resolve(outputDirectory, IN_DIR_NAME, `${entryFile2.name}.js`);
  const additionalEntryfile1OutputPath = path.resolve(
    outputDirectory,
    ADDITIONAL_IN_DIR_NAME,
    `${additionalEntryfile1.name}.js`,
  );
  const additionalEntryfile2OutputPath = path.resolve(
    outputDirectory,
    ADDITIONAL_IN_DIR_NAME,
    `${additionalEntryfile2.name}.js`,
  );

  await retryAssertion(t, (tt) => {
    tt.true(existsSync(entryFile1OutputPath));
    tt.true(existsSync(entryFile2OutputPath));
    tt.true(existsSync(additionalEntryfile1OutputPath));
    tt.true(existsSync(additionalEntryfile2OutputPath));
  });

  await del(directory);
});
