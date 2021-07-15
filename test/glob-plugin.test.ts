import * as esbuild from 'esbuild';
import { existsSync } from 'fs';
import fs from 'fs/promises';
import { customAlphabet } from 'nanoid';
import path from 'path';

import { globPlugin } from '../src';

// CONFIG
// ------

const FILE_DIR = path.resolve(__dirname, 'files');
const IN_DIR_NAME = 'input';
const OUT_DIR_NAME = 'output';
const DEPENDENCY_DIR_NAME = 'dependencies';

// Used to create directory and file names
const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 10);

// SINGLE RUN
// ----------

test(
  'the plugin resolves the provided globs',
  runner(
    async ({ build, directory }) => {
      const entryFile1 = await createEntryFile({ directory });
      const entryFile2 = await createEntryFile({ directory });

      build();
      await wait();

      expect(existsSync(entryFile1.outputPath)).toBe(true);
      expect(existsSync(entryFile2.outputPath)).toBe(true);
    },
    { watchMode: false },
  ),
);

// WATCH MODE
// ----------

// -- ADD
test(
  'the plugin builds newly added files',
  runner(async ({ directory }) => {
    const entryFile = await createEntryFile({ directory });

    expect(existsSync(entryFile.path)).toBe(true);
    expect(existsSync(entryFile.outputPath)).toBe(true);
  }),
);

// -- CHANGE
test(
  'the plugin triggers a new build when the entry file changes',
  runner(async ({ directory }) => {
    // Make entry file and get the file stats
    const entryFile = await createEntryFile({
      directory,
      withDependency: true,
    });
    const oldStats = await fs.stat(entryFile.outputPath);

    // Modify the entry file and get the new stats
    await entryFile.write({ dependencies: false, entry: true });
    await wait();

    const newStats = await fs.stat(entryFile.outputPath);

    // Compare the old and new modified time from stats
    expect(oldStats.mtime.getTime() < newStats.mtime.getTime()).toBe(true);
  }),
);

test(
  'the plugin triggers a new build when a dependency of an entry file changes',
  runner(async ({ directory }) => {
    // Make entry file and get the file stats
    const entryFile = await createEntryFile({
      directory,
      withDependency: true,
    });
    const oldStats = await fs.stat(entryFile.outputPath);

    // Modify the dependency and get the new stats
    entryFile.addDependency();
    await entryFile.write({ dependencies: true, entry: false });
    await wait();

    const newStats = await fs.stat(entryFile.outputPath);

    // Compare the old and new modified time from stats
    expect(oldStats.mtime.getTime() < newStats.mtime.getTime()).toBe(true);
  }),
);

// -- UNLINK

test(
  'the plugin removes the output file when a watched entry file is removed',
  runner(async ({ directory }) => {
    const entryFile = await createEntryFile({ directory });

    expect(existsSync(entryFile.outputPath)).toBe(true);

    // Remove entry file and make sure build is removed
    await entryFile.unlink();
    await wait();

    expect(existsSync(entryFile.outputPath)).toBe(false);
  }),
);

// UTILITY
// -------

/** Utility function to create and write an entry file */
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

  // Write file and wait for the plugin to pick it up
  await entryFile.write();
  await wait();

  return entryFile;
}

/** If awaited, waits the provided amount of milliseconds */
async function wait(ms = 500) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// -- TEST RUNNER

interface TestContext {
  build: () => void;
  /** Unique directory for the current test */
  directory: string;
}

function runner(
  testFunction: (testContext: TestContext) => Promise<void>,
  { watchMode } = { watchMode: true },
): () => Promise<void> {
  return async () => {
    const directory = path.resolve(FILE_DIR, nanoid());
    const inputDirectory = path.resolve(directory, IN_DIR_NAME);
    const outputDirectory = path.resolve(directory, OUT_DIR_NAME);
    const dependencyDirectory = path.resolve(directory, DEPENDENCY_DIR_NAME);
    const [plugin, pluginControls] = globPlugin({ controls: true });

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
    }

    // Test
    await testFunction({ build, directory }).finally(async () => {
      // Teardown
      await pluginControls.stopWatching();
      await fs.rm(directory, { recursive: true, force: true });
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
    return `import { ${this.name} } from '${this.path}';`;
  }

  public get path() {
    return path.resolve(this.directory, DEPENDENCY_DIR_NAME, `${this.name}.ts`);
  }
}
