import { nanoid } from 'nanoid';
import path from 'path';

import { DEPENDENCY_DIR_NAME } from './constants';

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

export { Dependency };
