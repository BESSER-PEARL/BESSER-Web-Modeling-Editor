const path = require('path');
const webpack = require('webpack');
const CircularDependencyPlugin = require('circular-dependency-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const Dotenv = require('dotenv-webpack');

const outputDir = path.resolve(__dirname, '../../../build/webapp');

module.exports = {
  entry: './src/main/index.tsx',
  output: {
    path: outputDir,
    filename: '[name].js',
    library: 'apollon',
    libraryTarget: 'umd',
  },
  resolve: {
    extensions: ['.js', '.ts', '.tsx'],
    alias: {
      '@besser/wme': path.resolve(__dirname, '../../editor/src/main/index.ts'),
      'shared': path.resolve(__dirname, '../../shared/src/index.ts'),
    },
  },
  performance: {
    hints: false,
  },
  module: {
    rules: [
      {
        test: /\.tsx?/,
        exclude: /\/node_modules\/(?!@besser\/wme)/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              transpileOnly: true,
              experimentalWatchApi: true,
              compilerOptions: {
                declaration: false,
              },
            },
          },
        ],
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.svg$/,
        use: ['@svgr/webpack'],
      },
    ],
  },
  optimization: {
    runtimeChunk: 'single',
    splitChunks: {
      cacheGroups: {
        defaultVendors: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
        },
      },
    },
  },
  plugins: [
    new Dotenv({
      path: path.resolve(__dirname, '.env'),
      systemvars: true,
      debug: true,
      safe: false
    }),
    new CircularDependencyPlugin({ exclude: /node_modules/ }),
    new HtmlWebpackPlugin({
      template: './src/main/index.html',
      favicon: './assets/images/favicon.ico',
      xhtml: true,
    }),
    new CopyPlugin({
      patterns: [
        {
          from: 'assets',
          to: outputDir,
        },
      ],
    }),
    new webpack.DefinePlugin({
      'process.env.APPLICATION_SERVER_VERSION': JSON.stringify(process.env.APPLICATION_SERVER_VERSION || true),
      // 'process.env.DEPLOYMENT_URL': JSON.stringify(process.env.DEPLOYMENT_URL || 'http://localhost:8080'),
      // 'process.env.BACKEND_URL': JSON.stringify(process.env.BACKEND_URL || 'http://localhost:9000/besser_api'),
      'process.env.SENTRY_DSN': JSON.stringify(process.env.SENTRY_DSN || null),
      'process.env.POSTHOG_HOST': JSON.stringify(process.env.POSTHOG_HOST || null),
      'process.env.POSTHOG_KEY': JSON.stringify(process.env.POSTHOG_KEY || null),
      // 'process.env.UML_BOT_WS_URL': JSON.stringify(process.env.UML_BOT_WS_URL || ''),
    }),
  ],
};
