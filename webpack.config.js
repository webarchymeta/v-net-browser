const
    path = require("path");

module.exports = {
    //name: language,
    target: 'electron-renderer',
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
        rules: [{
            test: /\.(js|jsx)$/,
            exclude: /(node_modules|bower_components)/,
            use: [{
                loader: 'babel-loader',
                options: {
                    presets: [
                        ['@babel/preset-env', {
                            "targets": {
                                "chrome": "83",
                                "firefox": "78"
                            }
                        }], '@babel/preset-react'
                    ]
                }
            }]
        }, {
            test: /\.json$/,
            use: ['json-loader'],
        }, {
            test: /\.less$/,
            use: ['style-loader', 'css-loader', 'less-loader']
        }, // use ! to chain loaders
        {
            test: /\.css$/,
            use: ['style-loader', 'css-loader']
        }, {
            test: /\.(png|jpg|woff|woff2|eot|ttf|svg)$/,
            use: [{
                loader: 'url-loader',
                options: {
                    limit: 8192
                }
            }]
        } // inline base64 URLs for <=8k images, direct URLs for the rest
        ]
    },
    plugins: []
};