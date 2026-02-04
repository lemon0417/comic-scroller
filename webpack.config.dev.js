var path = require('path');
var webpack = require('webpack');
var ExtractTextPlugin = require("extract-text-webpack-plugin");
var postcssNested = require('postcss-nested');

module.exports = {
  devtool: 'cheap-module-source-map',
  entry: {
    app: [
      'webpack-dev-server/client?http://localhost:8000',
      'webpack/hot/only-dev-server',
      './build/js/index'
    ],
    popup: [
      'webpack-dev-server/client?http://localhost:8000',
      'webpack/hot/only-dev-server',
      './build/js/popup'
    ]
  },
  output: {
    publicPath: 'http://localhost:8000/',
    path: path.join(__dirname, 'ComicsScroller'),
    filename: '[name].js',
  },
  plugins: [
    new webpack.HotModuleReplacementPlugin(),
    new webpack.NoEmitOnErrorsPlugin(),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
      'process.env.BABEL_ENV': JSON.stringify(process.env.BABEL_ENV || 'development')
    }),
  ],
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        loader: 'babel-loader',
        exclude: path.join(__dirname, 'node_modules'),
        query: {
          cacheDirectory: true
        }
      },
      {
        test: /\.css$/,
        use: [
          {
            loader: 'style-loader',
            options: {
              singleton: true
            }
          },
          {
            loader: 'css-loader',
            options: {
              autoprefixer: false,
              sourceMap: true,
              modules: true,
              importLoaders: 1,
              localIdentName: '[name]__[local]__[hash:base64:5]'
            }
          },
          {
            loader: 'postcss-loader',
          }
        ]
      },
      {
        test: /\.svg$/,
        use: [
          'babel-loader',
          'react-svg-loader'
        ]
      }
    ]
  },
  resolve: {
    alias: {
      css: path.join(__dirname, 'src/css'),
      '@css': path.join(__dirname, 'src/css'),
      imgs: path.join(__dirname, 'src/imgs'),
      '@imgs': path.join(__dirname, 'src/imgs'),
      cmp: path.join(__dirname, 'build/js/component')
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json', '.css']
  }
};
