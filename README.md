<h1 align="center">⚡️ esbuild plugin glob ⚡️</h1>
<p align="center">
  <img src="https://snyk.io/test/github/waspeer/esbuild-plugin-glob/badge.svg" />
</p>
<p align="center"><b>Use glob entry points in esbuild.</b></p>


This plugin allows the usage of [glob patterns](https://en.wikipedia.org/wiki/Glob_%28programming%29) as entry points for [esbuild](https://esbuild.github.io/). It supports single builds as well as watch mode.

## ⚠️ Deprecated ⚠️

[Esbuild now natively supports glob-style entrypoints since v0.19.0](https://github.com/evanw/esbuild/releases/tag/v0.19.0). This plugin is no longer needed.

Also note that this plugin is not yet compatible with esbuild v0.17.0 and up. It's a bit tricky to get it working with the new `context` api (`watch` mode in particular). If you'd like this functionality, please open an issue or a PR.

## Installation

Use a package manager like [yarn](https://yarnpkg.com/) or [npm](https://www.npmjs.com/)

```bash
yarn add esbuild-plugin-glob
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

### API and defaults

```typescript
globPlugin({
  // Optional additional entrypoints/glob patterns
  additionalEntrypoints: [],
  // Options directly passed to chokidar when in watch mode
  chokidarOptions: {},
  // Make the function return a `controls` object, see below
  controls: false,
  // An array of glob patterns to exclude matches
  ignore: []
  // Disables logging on file changes
  silent: false,
})
```

### Controls

By passing the option `controls: true` the `globPlugin` function returns a tuple with the plugin object and a controls object.

```typescript
import { globPlugin } from 'esbuild-plugin-glob';

const [glob, globControls] = globPlugin({ controls: true });

esbuild.build({
  entryPoints: ['src/**/*.tsx'],
  watch: true,
  plugins: [glob],
});

// Stops watching the entry files when in watch mode
await globControls.stopWatching();
```

## How it works

For single builds it simply resolves the provided glob patterns before esbuild runs.

In watch mode it uses [chokidar](https://github.com/paulmillr/chokidar) to watch the provided glob patterns and inspects the corresponding esbuild build results to make sure dependencies are also being watched.

## Contribute

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License

[MIT](https://choosealicense.com/licenses/mit/)
