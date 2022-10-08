import { promises as fs } from 'fs';
import { nanoid } from 'nanoid';
import path from 'path';

import { IN_DIR_NAME, OUT_DIR_NAME } from './constants';
import { Dependency } from './dependency';
import { randomString } from './util';

interface EntryFileRecipe {
  directory: string;
  name?: string;
  nested?: string | string[];
}

class EntryFile {
  public readonly directory: string;
  public readonly name: string;
  public readonly nested?: string[];
  public readonly dependencies: Dependency[] = [];
  public hasSyntaxError = false;

  constructor({ directory, name = randomString(), nested }: EntryFileRecipe) {
    this.directory = directory;
    this.name = name;
    this.nested = nested ? (Array.isArray(nested) ? nested : [nested]) : undefined;
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
    return path.resolve(this.directory, IN_DIR_NAME, ...(this.nested ?? []), `${this.name}.ts`);
  }

  public get outputPath() {
    return path.resolve(this.directory, OUT_DIR_NAME, ...(this.nested ?? []), `${this.name}.js`);
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
      await fs.unlink(this.path);
    }
  }

  public async write({ dependencies = true, entry = true } = {}) {
    if (this.nested) {
      await fs.mkdir(path.join(this.directory, IN_DIR_NAME, ...this.nested), { recursive: true });
    }

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

export { EntryFile };
