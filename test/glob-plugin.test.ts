import { existsSync, promises as fs } from 'fs';

import { runner, test } from './lib/runner';
import { createEntryFile, retryAssertion, wait } from './lib/util';

// SINGLE RUN
// ----------

test(
  'the plugin resolves globs provided as entrypoints',
  runner(async (t) => {
    const { build, directory } = t.context;
    const [entryFile1, entryFile2, ignoredFile] = await Promise.all([
      createEntryFile({ directory, suffix: 'entry' }),
      createEntryFile({ directory, suffix: 'entry' }),
      createEntryFile({ directory, suffix: 'ignored' }),
    ]);

    await build({
      entryPoints: ['**/*.entry.ts'],
      watchMode: false,
    });

    await retryAssertion(t, (tt) => {
      tt.true(existsSync(entryFile1.outputPath));
      tt.true(existsSync(entryFile2.outputPath));
      tt.false(existsSync(ignoredFile.outputPath));
    });
  }),
);

test(
  'the plugin handles non-glob entrypoints',
  runner(async (t) => {
    const { build, directory } = t.context;
    const [entryFile1, entryFile2, ignoredFile] = await Promise.all([
      createEntryFile({ directory, suffix: 'entry' }),
      createEntryFile({ directory, suffix: 'entry' }),
      createEntryFile({ directory, suffix: 'ignored' }),
    ]);

    await build({
      entryPoints: [entryFile1.path, entryFile2.path],
      watchMode: false,
    });

    await retryAssertion(t, (tt) => {
      tt.true(existsSync(entryFile1.outputPath));
      tt.true(existsSync(entryFile2.outputPath));
      tt.false(existsSync(ignoredFile.outputPath));
    });
  }),
);

test(
  'the plugin resolves globs provided as additionalEntrypoints',
  runner(async (t) => {
    const { build, directory } = t.context;
    const [additionalFile1, additionalFile2, ignoredFile] = await Promise.all([
      createEntryFile({ directory, suffix: 'additional' }),
      createEntryFile({ directory, suffix: 'additional' }),
      createEntryFile({ directory, suffix: 'ignored' }),
    ]);

    await build({
      entryPoints: [],
      pluginOptions: {
        additionalEntrypoints: ['**/*.additional.ts'],
      },
      watchMode: false,
    });

    await retryAssertion(t, (tt) => {
      tt.true(existsSync(additionalFile1.outputPath));
      tt.true(existsSync(additionalFile2.outputPath));
      tt.false(existsSync(ignoredFile.outputPath));
    });
  }),
);

test(
  'the plugin handles non-glob additionalEntrypoints',
  runner(async (t) => {
    const { build, directory } = t.context;
    const [additionalFile1, additionalFile2, ignoredFile] = await Promise.all([
      createEntryFile({ directory, suffix: 'additional' }),
      createEntryFile({ directory, suffix: 'additional' }),
      createEntryFile({ directory, suffix: 'ignored' }),
    ]);

    await build({
      entryPoints: [],
      pluginOptions: {
        additionalEntrypoints: [additionalFile1.path, additionalFile2.path],
      },
      watchMode: false,
    });

    await retryAssertion(t, (tt) => {
      tt.true(existsSync(additionalFile1.outputPath));
      tt.true(existsSync(additionalFile2.outputPath));
      tt.false(existsSync(ignoredFile.outputPath));
    });
  }),
);

test(
  'the plugin resolves globs provided both as entryPoints and as additionalEntrypoints',
  runner(async (t) => {
    const { build, directory } = t.context;
    const [entryFile1, entryFile2, additionalFile1, additionalFile2] = await Promise.all([
      createEntryFile({ directory, suffix: 'entry' }),
      createEntryFile({ directory, suffix: 'entry' }),
      createEntryFile({ directory, suffix: 'additional' }),
      createEntryFile({ directory, suffix: 'additional' }),
    ]);

    await build({
      entryPoints: ['**/*.entry.ts'],
      pluginOptions: {
        additionalEntrypoints: ['**/*.additional.ts'],
      },
      watchMode: false,
    });

    await retryAssertion(t, (tt) => {
      tt.true(existsSync(entryFile1.outputPath));
      tt.true(existsSync(entryFile2.outputPath));
      tt.true(existsSync(additionalFile1.outputPath));
      tt.true(existsSync(additionalFile2.outputPath));
    });
  }),
);

// WATCH MODE
// ----------

// -- ADD
test.only(
  'the plugin builds newly added files',
  runner(async (t) => {
    const { build, directory } = t.context;
    await build({ entryPoints: ['**/*.entry.ts'] });

    const [entryFile, ignoredFile] = await Promise.all([
      createEntryFile({ directory, suffix: 'entry' }),
      createEntryFile({ directory, suffix: 'ignored' }),
    ]);

    await retryAssertion(t, (tt) => {
      tt.true(existsSync(entryFile.path), 'the entry file was written');
      tt.true(existsSync(entryFile.outputPath), 'the output file was built');
      tt.true(existsSync(ignoredFile.path), 'the ignored file was written');
      tt.false(existsSync(ignoredFile.outputPath), 'the ignored file was not built');
    });
  }),
);

test.only(
  'the plugin builds newly added files provided as additionalEntrypoints',
  runner(async (t) => {
    const { build, directory } = t.context;
    await build({
      entryPoints: [],
      pluginOptions: {
        additionalEntrypoints: ['**/*.additional.ts'],
      },
    });

    const [additionalFile, ignoredFile] = await Promise.all([
      createEntryFile({ directory, suffix: 'additional' }),
      createEntryFile({ directory, suffix: 'ignored' }),
    ]);

    await retryAssertion(t, (tt) => {
      tt.true(existsSync(additionalFile.path), 'the additional file was written');
      tt.true(existsSync(additionalFile.outputPath), 'the output file was built');
      tt.true(existsSync(ignoredFile.path), 'the ignored file was written');
      tt.false(existsSync(ignoredFile.outputPath), 'the ignored file was not built');
    });
  }),
);

// -- CHANGE
test.only(
  'the plugin triggers a new build when the entry file changes',
  runner(async (t) => {
    const { build, directory } = t.context;
    await build();

    // Make test file and get the file stats
    const testFile = await createEntryFile({ directory });

    await retryAssertion(t, (tt) => {
      tt.true(existsSync(testFile.outputPath), 'the output file is built');
    });

    const oldStats = await fs.stat(testFile.outputPath);

    // Change the entry file
    await testFile.write();

    // Compare the old and new modified time from stats
    await retryAssertion(t, async (tt) => {
      const newStats = await fs.stat(testFile.outputPath);
      tt.true(oldStats.mtime.getTime() < newStats.mtime.getTime(), 'the output file was modified');
    });
  }),
);

test.only(
  'the plugin triggers a new build when a dependency of an entry file changes',
  runner(async (t) => {
    const { build, directory } = t.context;
    await build();

    // Make test file and get the file stats
    const testFile = await createEntryFile({ directory, withDependency: true });

    await retryAssertion(t, (tt) =>
      tt.true(existsSync(testFile.outputPath), 'the entry file is built'),
    );

    const oldStats = await fs.stat(testFile.outputPath);

    // Modify the dependency
    testFile.addDependency();
    await testFile.write({ dependencies: true, entry: false });

    // Compare the old and new modified time from stats
    await retryAssertion(t, async (tt) => {
      const newStats = await fs.stat(testFile.outputPath);
      tt.true(oldStats.mtime.getTime() < newStats.mtime.getTime(), 'the output file was modified');
    });
  }),
);

test.only(
  'the plugin should not crash when adding syntax errors to a file',
  runner(async (t) => {
    const { build, directory } = t.context;
    await build();

    // Make test file and get the file stats
    const testFile = await createEntryFile({ directory });

    await retryAssertion(t, (tt) =>
      tt.true(existsSync(testFile.outputPath), 'the entry file is built'),
    );

    const oldStats = await fs.stat(testFile.outputPath);

    // Modify the file
    testFile.addSyntaxError();
    await testFile.write();
    await wait(100);

    // Modify the file again
    testFile.removeSyntaxError();
    await testFile.write();

    // Compare the old and new modified time from stats
    await retryAssertion(t, async (tt) => {
      const newStats = await fs.stat(testFile.outputPath);
      tt.true(oldStats.mtime.getTime() < newStats.mtime.getTime(), 'the output file was modified');
    });
  }),
);

// -- UNLINK
test.only(
  'the plugin removes the output file when a watched entry file is removed',
  runner(async (t) => {
    const { build, directory } = t.context;
    await build();

    // Make entry file and make sure build exists
    const testFile = await createEntryFile({ directory });

    await retryAssertion(t, (tt) =>
      tt.true(existsSync(testFile.outputPath), 'the entry file is built'),
    );

    // Remove entry file and make sure build is removed
    await wait();
    await testFile.unlink();
    await retryAssertion(t, (tt) =>
      tt.false(existsSync(testFile.outputPath), 'the output file is removed'),
    );
  }),
);

// EDGE CASES
// ----------

test(
  'the plugin should handle exclude patterns in globs',
  runner(async (t) => {
    const { build, directory } = t.context;
    const nested = ['nested', 'nested'];

    const [entry, ignored, nestedEntry, nestedIgnored] = await Promise.all([
      createEntryFile({ directory }),
      createEntryFile({ directory, suffix: 'ignored' }),
      createEntryFile({ directory, nested }),
      createEntryFile({ directory, nested, suffix: 'ignored' }),
    ]);

    await build({
      entryPoints: ['**/!(*.ignored).ts'],
      watchMode: false,
    });

    await retryAssertion(t, (tt) => {
      tt.true(existsSync(entry.outputPath));
      tt.true(existsSync(nestedEntry.outputPath));
      tt.false(existsSync(ignored.outputPath));
      tt.false(existsSync(nestedIgnored.outputPath));
    });
  }),
);
