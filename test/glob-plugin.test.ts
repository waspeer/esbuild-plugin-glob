import { existsSync, promises as fs } from 'fs';

import { runner, test } from './runner';
import { createEntryFile, retryAssertion, wait } from './util';

// SINGLE RUN
// ----------

test(
  'the plugin resolves the provided globs',
  runner(
    async (t) => {
      const { build, directory } = t.context;
      const entryFile1 = await createEntryFile({ directory });
      const entryFile2 = await createEntryFile({ directory });

      build();

      await retryAssertion(t, (tt) => {
        tt.true(existsSync(entryFile1.outputPath));
        tt.true(existsSync(entryFile2.outputPath));
      });
    },
    { watchMode: false },
  ),
);

// WATCH MODE
// ----------

// -- ADD
test.serial(
  'the plugin builds newly added files',
  runner(async (t) => {
    const { directory } = t.context;
    const testFile = await createEntryFile({ directory });

    await retryAssertion(t, (tt) => {
      tt.true(existsSync(testFile.path), 'the entry file was written');
      tt.true(existsSync(testFile.outputPath), 'the output file was built');
    });
  }),
);

// -- CHANGE
test.serial(
  'the plugin triggers a new build when the entry file changes',
  runner(async (t) => {
    const { directory } = t.context;

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

test.serial(
  'the plugin triggers a new build when a dependency of an entry file changes',
  runner(async (t) => {
    const { directory } = t.context;

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

test.serial(
  'the plugin should not crash when adding syntax errors to a file',
  runner(async (t) => {
    const { directory } = t.context;

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

test.serial(
  'the plugin removes the output file when a watched entry file is removed',
  runner(async (t) => {
    const { directory } = t.context;

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

// -- Type the untyped
export interface TestContext {
  /** Triggers a build */
  build: () => void;
  /** Unique directory for current test */
  directory: string;
}
