const avaConfig = {
  extensions: ['ts'],
  failWithoutAssertions: false,
  files: ['test/glob-plugin.test.ts'],
  ignoredByWatcher: ['src/files/**/*'],
  require: ['ts-node/register'],
};

export default avaConfig;
