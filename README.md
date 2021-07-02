<h1 align="center">⚡️ esbuild plugin glob ⚡️</h1>
<p align="center"><b>Use glob entry points in esbuild.</b></p>

This plugin allows the usage of [glob patterns](https://en.wikipedia.org/wiki/Glob_%28programming%29) as entry points for [esbuild](https://esbuild.github.io/). It supports single builds as well as watch mode.

## Installation

Use a package manager like [yarn](https://yarnpkg.com/) or [npm](https://www.npmjs.com/)

```bash
yarn install esbuild-plugin-glob
```

## Usage

```typescript
import { globPlugin } from 'esbuild-plugin-glob';

esbuild.build({
  entryPoints: ['src/**/*.tsx'],
  // watch: true,
  plugins: [globPlugin()],
});
```

## How it works

For single builds it simply resolves the provided glob patterns before esbuild runs.

In watch mode it uses [chokidar](https://github.com/paulmillr/chokidar) to watch the provided glob patterns and inspects the corresponding esbuild build results to make sure dependencies are also being watched.

## Contribute

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License

[MIT](https://choosealicense.com/licenses/mit/)
