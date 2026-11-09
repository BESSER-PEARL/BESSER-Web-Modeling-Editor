var fs = require('fs');
var path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const { DefinePlugin } = require('webpack');

// Vite reads this file for the webapp bundle; variables already in the environment win, in both.
const webappEnvFile = path.resolve(__dirname, '../../webapp/.env');
if (fs.existsSync(webappEnvFile)) {
  process.loadEnvFile(webappEnvFile);
}

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
  plugins: [
    // Build-time values, as in the webapp bundle: the Content-Security-Policy must allow what it was built with.
    new DefinePlugin({
      'process.env.BACKEND_URL': JSON.stringify(process.env.BACKEND_URL ?? ''),
      'process.env.UML_BOT_WS_URL': JSON.stringify(process.env.UML_BOT_WS_URL ?? ''),
      'process.env.POSTHOG_HOST': JSON.stringify(process.env.POSTHOG_HOST ?? ''),
    }),
  ],
};
