import { promises as fs } from 'fs';
import { nanoid } from 'nanoid';
import path from 'path';

import { ADDITIONAL_IN_DIR_NAME, IN_DIR_NAME, OUT_DIR_NAME } from './constants';
import { Dependency } from './dependency';

// -- ENTRY FILE
interface EntryFileRecipe {
  name?: string;
  directory: string;
}

class EntryFile {
  public readonly directory: string;
  public readonly name: string;
  public readonly dependencies: Dependency[] = [];
  public hasSyntaxError = false;

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

    // Content
    contents.push(
      `console.log('NAME', '${this.name}');`,
      `console.log('RANDOM STRING', '${nanoid()}');`,
      this.hasSyntaxError ? 'import;' : '',
    );

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

  public addSyntaxError() {
    this.hasSyntaxError = true;
  }

  public removeSyntaxError() {
    this.hasSyntaxError = false;
  }

  public async unlink({ dependencies = false, entry = true } = {}) {
    if (dependencies) {
      await Promise.all(this.dependencies.map((dependency) => fs.unlink(dependency.path)));
    }

    if (entry) {
      fs.unlink(this.path);
    }
  }

  public async write({ dependencies = true, entry = true } = {}) {
    if (dependencies) {
      await Promise.all(
        this.dependencies.map((dependency) => fs.writeFile(dependency.path, dependency.contents)),
      );
    }

    if (entry) {
      fs.writeFile(this.path, this.contents);
    }
  }
}

class AdditionalEntryFile extends EntryFile {
  public get path() {
    return path.resolve(this.directory, ADDITIONAL_IN_DIR_NAME, `${this.name}.ts`);
  }
}

export { EntryFile, AdditionalEntryFile };
