import type { ExecutionContext, Implementation, TestInterface } from 'ava';
import untypedTest from 'ava';
import del from 'del';
import * as esbuild from 'esbuild';
import { existsSync, promises as fs } from 'fs';
import { customAlphabet } from 'nanoid';
import path from 'path';

import { globPlugin } from '../src';

// CONFIG
// ------

// -- Directories used for test files
const FILE_DIR = path.resolve(__dirname, 'files');
const IN_DIR_NAME = 'input';
const OUT_DIR_NAME = 'output';
const DEPENDENCY_DIR_NAME = 'dependencies';

// -- Config for assertion retrying
const MAX_RETRIES = 50;
const RETRY_INTERVAL = 100;

// -- Used to create directory and file names
const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 10);

// -- Type the untyped
interface TestContext {
  /** Triggers a build */
  build: () => void;
  /** Unique directory for current test */
  directory: string;
}

const test = untypedTest as TestInterface<TestContext>;

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

// UTILITY
// -------

/** Convenience function to create and write an entry file */
async function createEntryFile({
  directory,
  withDependency = false,
}: {
  directory: string;
  withDependency?: boolean;
}) {
  const entryFile = new EntryFile({ directory });

  if (withDependency) {
    entryFile.addDependency();
  }

  await entryFile.write();
  return entryFile;
}

/** Retries the assertion every x ms for a maximum amount of times */
async function retryAssertion(t: ExecutionContext, assertion: Implementation): Promise<void> {
  return new Promise((resolve, reject) => {
    let tried = 0;

    function planNextCheck() {
      setTimeout(async () => {
        tried += 1;

        const maxRetriesReached = tried >= MAX_RETRIES;
        const attempt = await t.try(assertion);

        if (attempt.passed) {
          attempt.commit();
          return resolve();
        }

        if (maxRetriesReached) {
          attempt.commit();
          return reject();
        }

        attempt.discard();
        planNextCheck();
      }, RETRY_INTERVAL);
    }

    planNextCheck();
  });
}

async function wait(ms = 500) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

// -- TEST RUNNER

function runner(
  testFunction: Implementation<TestContext>,
  { watchMode } = { watchMode: true },
): Implementation<TestContext> {
  return async (t: ExecutionContext<TestContext>) => {
    const directory = path.resolve(FILE_DIR, nanoid());
    const inputDirectory = path.resolve(directory, IN_DIR_NAME);
    const outputDirectory = path.resolve(directory, OUT_DIR_NAME);
    const dependencyDirectory = path.resolve(directory, DEPENDENCY_DIR_NAME);
    const [plugin, pluginControls] = globPlugin({
      controls: true,
    });

    // Prepare
    await Promise.all([
      fs.mkdir(inputDirectory, { recursive: true }),
      fs.mkdir(outputDirectory, { recursive: true }),
      fs.mkdir(dependencyDirectory, { recursive: true }),
    ]);

    function build() {
      esbuild.build({
        bundle: true,
        entryPoints: [path.resolve(inputDirectory, '**/*')],
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

// -- ENTRY FILE
interface EntryFileRecipe {
  name?: string;
  directory: string;
}

class EntryFile {
  public readonly directory: string;
  public readonly name: string;
  public readonly dependencies: Dependency[] = [];

  constructor({ name = nanoid(), directory }: EntryFileRecipe) {
    this.name = name;
    this.directory = directory;
  }

  public get contents() {
    const contents: string[] = [];

    // Imports
    this.dependencies.forEach((dependency) => {
      contents.push(dependency.importStatement);
    });

    // Default content
    contents.push(`console.log('NAME', '${this.name}');`);
    contents.push(`console.log('RANDOM STRING', '${nanoid()}');`);

    // Dependency content
    this.dependencies.forEach((dependency) => {
      contents.push(dependency.codeBlock);
    });

    return contents.join('\n');
  }

  public get path() {
    return path.resolve(this.directory, IN_DIR_NAME, `${this.name}.ts`);
  }

  public get outputPath() {
    return path.resolve(this.directory, OUT_DIR_NAME, `${this.name}.js`);
  }

  public addDependency() {
    this.dependencies.push(new Dependency({ directory: this.directory }));
  }

  public async unlink({ dependencies, entry } = { dependencies: false, entry: true }) {
    if (dependencies) {
      await Promise.all(this.dependencies.map((dependency) => fs.unlink(dependency.path)));
    }

    if (entry) {
      await fs.unlink(this.path);
    }
  }

  public async write({ dependencies, entry } = { dependencies: true, entry: true }) {
    if (dependencies) {
      await Promise.all(
        this.dependencies.map((dependency) => fs.writeFile(dependency.path, dependency.contents)),
      );
    }

    if (entry) {
      await fs.writeFile(this.path, this.contents);
    }
  }
}

// -- DEPENDENCY
interface DependencyRecipe {
  directory: string;
  name?: string;
}

class Dependency {
  public readonly name: string;
  public readonly directory: string;

  constructor({ directory, name = nanoid() }: DependencyRecipe) {
    this.directory = directory;
    this.name = name;
  }

  public get codeBlock() {
    return `console.log('DEPENDENCY', ${this.name}());`;
  }

  public get contents() {
    return `export const ${this.name} = () => '${this.name}';`;
  }

  public get importStatement() {
    return `import { ${this.name} } from '../${DEPENDENCY_DIR_NAME}/${this.name}';`;
  }

  public get path() {
    return path.resolve(this.directory, DEPENDENCY_DIR_NAME, `${this.name}.ts`);
  }
}
