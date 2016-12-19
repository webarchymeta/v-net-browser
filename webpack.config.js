const
    path = require("path");

module.exports = {
    //name: language,
    target: 'electron',
    context: __dirname,
    entry: {
        "main": './browser.jsx'
    },
    output: {
        path: __dirname,
        filename: '[name]-bundle.js',
        chunkFilename: '[id].chunk.js',
        publicPath: '/'
    },
    module: {
        loaders: [{
                test: /\.(js|jsx)$/,
                loader: 'babel-loader',
                exclude: /(node_modules|bower_components)/,
                query: {
                    presets: ['es2015', 'react']
                }
            }, {
                test: /\.json$/,
                loader: 'json'
            }, {
                test: /\.less$/,
                loader: 'style-loader!css-loader!less-loader'
            }, // use ! to chain loaders
            {
                test: /\.css$/,
                loader: 'style-loader!css-loader'
            }, {
                test: /\.(png|jpg|woff|woff2|eot|ttf|svg)$/,
                loader: 'url-loader?limit=8192'
            } // inline base64 URLs for <=8k images, direct URLs for the rest
        ]
    },
    plugins: [
    ]
};