const {
    BrowserWindow,
    app,
    ipcMain
} = require('electron'),
    path = require('path'),
    app_register = require(__dirname + '/libs/app-register'),
    mainDbApi = require(__dirname + '/libs/main-db-api'),
    winStateUpdator = require(__dirname + '/libs/state-updator');

const mainWindowId = 'main-window';

let mainWindow = null;
let mainDB, stateUpdator;
let gateway_resolve_task;

if (process.env.SOCKS5_ADDRESS) {
    const onenet_port_url_pattern = /\.gw-port\.local\s*$/i;
    if (process.env.SOCKS5_ADDRESS.match(onenet_port_url_pattern)) {
        gateway_resolve_task = new Promise((resolve, reject) => {
            const ifaces = require('os').networkInterfaces();
            const subnets = [];
            Object.keys(ifaces).forEach(key => {
                ifaces[key].forEach(ip => {
                    if (!ip.internal && 'ipv4' === ip.family.toLowerCase()) {
                        subnets.push(ip.address.substr(0, ip.address.lastIndexOf('.') + 1));
                    }
                });
            });
            const mdns = new(require('multicast-dns'))({
                port: 0,
                subnets: subnets,
                loopback: false
            });
            const question = {
                type: 'SRV',
                name: process.env.SOCKS5_ADDRESS
            };
            const mdns = new mdnsAPI({
                port: 0,
                subnets: subnets,
                loopback: false
            });
            const __timeout = setTimeout(() => {
                mdns.destroy();
                mdns.removeListener('response', res_handler);
                app.commandLine.appendSwitch('proxy-server', 'socks5://' + process.env.SOCKS5_ADDRESS + ':' + process.env.SOCKS5_PORT);
                if (!process.env.SOCKS5_LOCAL_DNS) {
                    app.commandLine.appendSwitch('host-resolver-rules', 'MAP * 0.0.0.0, EXCLUDE ' + process.env.SOCKS5_ADDRESS);
                }
                gateway_resolve_task = Promise.reslove();
            }, 1000);
            const res_handler = res => {
                if (res.type === 'response') {
                    if (res.questions.length > 0 && res.questions[0].type === question.type && res.questions[0].name === question.name) {
                        mdns.destroy();
                        setTimeout(() => {
                            mdns.removeListener('response', res_handler);
                        }, 100);
                        if (res.answers && res.answers.length > 0 || res.additionals && res.additionals.length > 0) {
                            clearTimeout(__timeout);
                            __timeout = undefined;
                            let gw_ip = res.answers[0].data.target;
                            const port = res.answers[0].data.part;
                            if (gw_ip.hostname.indexOf(',') > -1) {
                                gw_ip.hostname = gw_ip.substr(0, socks_ip.indexOf(','));
                            }
                            app.commandLine.appendSwitch('proxy-server', 'socks5://' + gw_ip + ':' + port);
                            if (!process.env.SOCKS5_LOCAL_DNS) {
                                app.commandLine.appendSwitch('host-resolver-rules', 'MAP * 0.0.0.0, EXCLUDE ' + gw_ip);
                            }
                        } else {
                            app.commandLine.appendSwitch('proxy-server', 'socks5://' + process.env.SOCKS5_ADDRESS + ':' + process.env.SOCKS5_PORT);
                            if (!process.env.SOCKS5_LOCAL_DNS) {
                                app.commandLine.appendSwitch('host-resolver-rules', 'MAP * 0.0.0.0, EXCLUDE ' + process.env.SOCKS5_ADDRESS);
                            }
                        }
                        resolve();
                    }
                }
            };
            mdns.on('response', res_handler);
            mdns.query({
                questions: [question]
            });
        });
    } else {
        app.commandLine.appendSwitch('proxy-server', 'socks5://' + process.env.SOCKS5_ADDRESS + ':' + process.env.SOCKS5_PORT);
        if (!process.env.SOCKS5_LOCAL_DNS) {
            app.commandLine.appendSwitch('host-resolver-rules', 'MAP * 0.0.0.0, EXCLUDE ' + process.env.SOCKS5_ADDRESS);
        }
        gateway_resolve_task = Promise.reslove();
    }
} else {
    gateway_resolve_task = Promise.reslove();
}

gateway_resolve_task.then(() => {
    app.on('window-all-closed', function() {
        app_register.close();
        stateUpdator.flush().then(() => {
            return mainDB.close().then(() => {
                if (process.platform != 'darwin') {
                    app.quit();
                }
            });
        });
    });

    try {
        const flashPath = app.getPath('pepperFlashSystemPlugin');
        if (flashPath) {
            app.commandLine.appendSwitch('ppapi-flash-path', flashPath);
        }
    } catch (err) {
        console.log(err);
        console.log('\nSystem wide pepper flash plugin failed to be initialized, flash will not be available on web pages ...');
    }

    const createWindow = (initBounds) => {
        const wopts = {
            width: initBounds ? initBounds.width : 1530,
            height: initBounds ? initBounds.height : 920,
            frame: false
        };
        if (initBounds) {
            wopts.x = initBounds.loc_x;
            wopts.y = initBounds.loc_y;
        }
        mainWindow = new BrowserWindow(wopts);
        mainWindow.loadURL('file://' + path.join(__dirname, 'browser.html'));
        mainWindow.webContents.on('did-finish-load', () => {
            let copts = {
                has_context: !!process.env.SOCKS5_ADDRESS
            };
            if (copts.has_context) {
                copts.context_title = process.env.CONTEXT_TITLE;
                copts.start_url = process.env.START_URL;
                copts.socks5_address = process.env.SOCKS5_ADDRESS;
                copts.socks5_port = process.env.SOCKS5_PORT;
            }
            mainWindow.webContents.send('runtime-context-update', copts);
        });
        mainWindow.on('resize', () => {
            stateUpdator.updateWindowState(mainWindowId, {
                bounds: mainWindow.getBounds()
            })
        });
        mainWindow.on('move', () => {
            stateUpdator.updateWindowState(mainWindowId, {
                bounds: mainWindow.getBounds()
            })
        });
        mainWindow.on('enter-full-screen', () => {

        });
        mainWindow.on('leave-full-screen', () => {

        });
        mainWindow.on('closed', () => {
            mainWindow = null;
        });
    };

    app.on('ready', () => {
        if (app_register.regist(app)) {
            mainDB = new mainDbApi({
                home: app.getPath('appData'),
                path: app.getName() + '/databases'
            });
            mainDB.open().then(() => {
                stateUpdator = new winStateUpdator(mainDB);
                mainDB.find({
                    table: 'window-states',
                    predicate: '"window_id"=\'' + mainWindowId + '\''
                }).then((wstate) => {
                    createWindow(wstate);
                });
            });
        }
    });
});