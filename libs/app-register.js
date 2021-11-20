'use strict';

const
    path = require('path'),
    os = require('os'),
    crypto = require('crypto');
//inter_proc_ipc = require('node-ipc');

let ipc_connected = false;

const get_app_id = () => {
    let md5 = crypto.createHash('md5');
    md5.update(path.join(__dirname, '../index.js').toLowerCase());
    return md5.digest('hex');
};

const register_app = (app) => {
    const is_register = process.argv.length > 2 && process.argv[2] === '--register';
    return import('node-ipc').then(ipc => {
        const inter_proc_ipc = ipc.default;
        inter_proc_ipc.config.id = 'socks_app_register';
        inter_proc_ipc.config.retry = 1500;
        inter_proc_ipc.config.maxRetries = is_register ? 0 : 3;
        inter_proc_ipc.config.silent = true;
        inter_proc_ipc.connectTo('inter_app_services', () => {
            inter_proc_ipc.of.inter_app_services.on('connect', () => {
                ipc_connected = true;
                inter_proc_ipc.log('## connected to inter_app_services ##'.rainbow, inter_proc_ipc.config.delay);
                const data = {
                    id: get_app_id(),
                    categ: 'socks',
                    type: process.env.APP_TYPE || 'browser',
                    runtime: path.sep + 'node_modules' + path.sep + '.bin' + path.sep + 'electron' + (os.platform() === 'win32' ? '.cmd' : ''),
                    entryFile: 'main-entry.js',
                    name: '1-net-browser', //app.getName(),
                    appPath: path.join(__dirname, '../'),
                    pid: process.pid,
                    single_instance: true,
                    started: true
                };
                inter_proc_ipc.of.inter_app_services.emit('socks-client-register', data);
                if (is_register) {
                    console.log('OK, the current app is registered with 1-NET client. It can be launched there. Have a good day!');
                    setTimeout(() => {
                        process.exit(0);
                    }, 500);
                }
            });
            inter_proc_ipc.of.inter_app_services.on('error', (err) => {
                if (err.code === 'ENOENT') {
                    if (!is_register) {
                        console.log('fail to connect [ENOENT]');
                    } else {
                        console.log('1-NET client application can not be reached, the registration failed.');
                        process.exit(1);
                    }
                } else {
                    console.log(err);
                }
            });
            inter_proc_ipc.of.inter_app_services.on('disconnect', () => {
                inter_proc_ipc.log('disconnected from socks_app_register'.notice);
            });
            inter_proc_ipc.of.inter_app_services.on('socks-client-register-ack', (data) => {
                inter_proc_ipc.log('got a message from socks_app_register : '.debug, data);
            });
        });
        return !is_register;
    });
};

module.exports = {
    regist: register_app,
    close: () => {
        if (ipc_connected) {
            inter_proc_ipc.of.inter_app_services.emit('socks-client-status', {
                id: get_app_id(),
                pid: process.pid,
                started: false
            });
        }
    }
};