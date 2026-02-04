var path = require('path');
var webpack = require('webpack');

module.exports = {
  entry: ['./build/js/background.js'],
  output: {
    path: path.join(__dirname, 'ComicsScroller/js'),
    filename: 'background.js',
  },
  plugins: [],
  module: {
    loaders: [
      {
        test: /\.jsx?$/,
        loader: 'babel-loader?cacheDirectory',
        include: [
          path.join(__dirname, 'src'),
          path.join(__dirname, 'build'),
        ],
        exclude: path.join(__dirname, 'node_modules'),
      },
    ],
  },
  resolve: {
    alias: {
      css: path.join(__dirname, 'src/css'),
      imgs: path.join(__dirname, 'src/imgs'),
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json', '.css'],
  },
};
