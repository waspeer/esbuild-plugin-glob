import path from 'path';

import { DEPENDENCY_DIR_NAME } from './constants';
import { randomString } from './util';

interface DependencyRecipe {
  directory: string;
  name?: string;
}

class Dependency {
  public readonly name: string;
  public readonly directory: string;

  constructor({ directory, name = randomString() }: DependencyRecipe) {
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

export { Dependency };
