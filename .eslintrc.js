module.exports = {
  extends: ['@waspeer/eslint-config', 'plugin:jest/recommended'],
  env: {
    node: true,
  },
  rules: {
    'unicorn/no-null': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
  },
};
