var path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: './src/main/server.ts',
  target: 'node',
  mode: 'production',
  devtool: 'inline-source-map',
  node: {
    __dirname: true,
  },
  output: {
    path: path.resolve(__dirname, '../../../build/server/'),
    filename: 'bundle.js',
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'], //resolve all the modules other than index.ts
    alias: {
      '@besser/wme': path.resolve(__dirname, '../../library/lib/index.tsx'),
      // The library's own source uses `@/*` -> `lib/*` internally (see
      // packages/library/tsconfig.json / vite.config.ts). Webpack has no
      // knowledge of that alias on its own, so bundling `@besser/wme` from
      // source (above) needs the same mapping here.
      '@': path.resolve(__dirname, '../../library/lib'),
      // Exactly one React in the bundle. packages/library ships its own
      // react / react-dom copy while React Flow, MUI, zustand, … resolve the
      // hoisted root copy; with both bundled, hooks inside those deps ran
      // against the other copy's (null) dispatcher and headless SVG export
      // crashed the server ("Cannot read properties of null (reading
      // 'useState')"). Prefix aliases so `react/jsx-runtime` and
      // `react-dom/client` follow.
      react: path.resolve(__dirname, '../../../node_modules/react'),
      'react-dom': path.resolve(__dirname, '../../../node_modules/react-dom'),
    },
    fallback: {
      fs: false,
      path: false,
    },
  },
  module: {
    rules: [
      {
        use: {
          loader: 'ts-loader',
          options: {
            transpileOnly: true,
            compilerOptions: {
              declaration: false,
              // The bundled library (`@besser/wme` from source) is written for
              // the automatic JSX runtime (packages/library/tsconfig.json
              // `"jsx": "react-jsx"`) and does not `import React` in every
              // file; the classic `'react'` transform made headless SVG
              // export fail with "React is not defined".
              jsx: 'react-jsx',
            },
            onlyCompileBundledFiles: true,
          },
        },
        test: /\.tsx?$/,
        exclude: /node_modules/,
      },
      {
        use: 'node-loader',
        test: /\.node$/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ],
  },
  externals: {
    'utf-8-validate': 'utf-8-validate',
  },
  plugins: [],
};
