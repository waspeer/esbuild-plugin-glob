const avaConfig = {
  extensions: ['ts'],
  failWithoutAssertions: false,
  files: ['test/*.test.ts'],
  ignoredByWatcher: ['test/files/**/*'],
  require: ['esbuild-register'],
};

export default avaConfig;
