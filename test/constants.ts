import path from 'path';

// -- Directories used for test files

const FILE_DIR_NAME = 'files';
const IN_DIR_NAME = 'input';
const ADDITIONAL_IN_DIR_NAME = 'additional';
const OUT_DIR_NAME = 'output';
const DEPENDENCY_DIR_NAME = 'dependencies';
const FILE_DIR = path.resolve(__dirname, FILE_DIR_NAME);

export {
  IN_DIR_NAME,
  FILE_DIR,
  FILE_DIR_NAME,
  ADDITIONAL_IN_DIR_NAME,
  OUT_DIR_NAME,
  DEPENDENCY_DIR_NAME,
};
