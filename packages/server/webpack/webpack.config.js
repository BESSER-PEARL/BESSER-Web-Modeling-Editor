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
              jsx: 'react',
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
