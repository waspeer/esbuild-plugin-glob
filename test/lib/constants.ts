import path from 'path';

// Directories used for test files

const DEPENDENCY_DIR_NAME = 'dependencies';
const FILE_DIR_NAME = 'files';
const IN_DIR_NAME = 'input';
const OUT_DIR_NAME = 'output';
const FILE_DIR = path.resolve(__dirname, '..', FILE_DIR_NAME);

export { DEPENDENCY_DIR_NAME, FILE_DIR_NAME, FILE_DIR, IN_DIR_NAME, OUT_DIR_NAME };
