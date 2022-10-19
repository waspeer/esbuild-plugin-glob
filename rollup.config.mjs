// @ts-check
import dts from 'rollup-plugin-dts';
import esbuild from 'rollup-plugin-esbuild';

import pkg from './package.json' assert { type: 'json' };

/** @type {(config: import('rollup').RollupOptions) => import('rollup').RollupOptions} */
function bundle(config) {
  return {
    ...config,
    input: 'src/index.ts',
    external: [
      ...Object.keys(pkg.dependencies || {}),
      ...Object.keys(pkg.devDependencies || {}),
      'fs',
      'path',
    ],
  };
}

/** @type {import('rollup').RollupOptions[]} */
const config = [
  bundle({
    plugins: [
      esbuild({
        target: ['node10'],
      }),
    ],
    output: [
      { file: pkg.main, format: 'cjs', sourcemap: true },
      { file: pkg.module, format: 'es', sourcemap: true },
    ],
  }),
  bundle({
    plugins: [dts()],
    output: {
      file: pkg.typings,
      format: 'es',
    },
  }),
];

export default config;
