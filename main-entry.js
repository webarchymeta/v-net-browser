const {
    BrowserWindow,
    app,
    ipcMain
} = require('electron'),
    path = require('path'),
    dns_client = require(__dirname + '/libs/dns-client'),
    app_register = require(__dirname + '/libs/app-register'),
    mainDbApi = require(__dirname + '/libs/main-db-api'),
    winStateUpdator = require(__dirname + '/libs/state-updater');

const mainWindowId = 'main-window';

let mainWindow = null;
let mainDB, stateUpdator;
let gateway_resolve_task;

if (process.env.SOCKS5_ADDRESS) {
    const onenet_port_url_pattern = /\.gw-port\.local\s*$/i;
    if (process.env.SOCKS5_ADDRESS.match(onenet_port_url_pattern)) {
        const dns = new(requie(__dirname + '/libs/dns-client'))();
        gateway_resolve_task = dns.find(process.env.SOCKS5_ADDRESS).then(result => {
            if (result) {
                app.commandLine.appendSwitch('proxy-server', 'socks5://' + result.socks5_address + ':' + result.socks5_port);
                if (!process.env.SOCKS5_LOCAL_DNS) {
                    app.commandLine.appendSwitch('host-resolver-rules', 'MAP * 0.0.0.0, EXCLUDE ' + result.socks5_address);
                }
            } else {
                app.commandLine.appendSwitch('proxy-server', 'socks5://' + process.env.SOCKS5_ADDRESS + ':' + process.env.SOCKS5_PORT);
                if (!process.env.SOCKS5_LOCAL_DNS) {
                    app.commandLine.appendSwitch('host-resolver-rules', 'MAP * 0.0.0.0, EXCLUDE ' + process.env.SOCKS5_ADDRESS);
                }
            }
        });
    } else {
        app.commandLine.appendSwitch('proxy-server', 'socks5://' + process.env.SOCKS5_ADDRESS + ':' + process.env.SOCKS5_PORT);
        if (!process.env.SOCKS5_LOCAL_DNS) {
            app.commandLine.appendSwitch('host-resolver-rules', 'MAP * 0.0.0.0, EXCLUDE ' + process.env.SOCKS5_ADDRESS);
        }
        gateway_resolve_task = Promise.resolve();
    }
} else {
    gateway_resolve_task = Promise.resolve();
}

const windowAllClosed = () => {
    if (!process.env.PRODUCTION_MODE) {
        app_register.close();
    }
    stateUpdator.flush().then(() => {
        return mainDB.close().then(() => {
            if (process.platform != 'darwin') {
                app.quit();
            }
        });
    });
};

const startup = () => {
    return gateway_resolve_task.then(() => {
        try {
            const flashPath = app.getPath('pepperFlashSystemPlugin');
            if (flashPath) {
                app.commandLine.appendSwitch('ppapi-flash-path', flashPath);
            }
        } catch (err) {
            console.log(err);
            console.log('\nSystem wide pepper flash plugin failed to be initialized, flash will not be available on web pages ...');
        }

        ipcMain.on('mdns-query', (e, q) => {
            const dns = new dns_client();
            dns.find(q.hostname, 'SRV').then(resp => {
                e.sender.send('mdns-query-ack', {
                    ok: true,
                    response: resp
                });
            }).catch(err => {
                e.sender.send('mdns-query-ack', {
                    ok: false,
                    error: err
                });
            });
        });

        ipcMain.on('full-screen-mode', (e, d) => {
            mainWindow.setFullScreen(d.on);
        });

        const createWindow = initBounds => {
            const wopts = {
                width: initBounds ? initBounds.width : 1530,
                height: initBounds ? initBounds.height : 920,
                frame: false,
                icon: __dirname + '/images/v-net-browser.png',
                webPreferences: {
                    nodeIntegration: true,
                    webviewTag: true
                }
            };
            if (initBounds) {
                wopts.x = initBounds.loc_x;
                wopts.y = initBounds.loc_y;
            }
            mainWindow = new BrowserWindow(wopts);
            //mainWindow.webContents.openDevTools();
            mainWindow.loadURL('file://' + path.join(__dirname, 'browser.html'));
            mainWindow.webContents.on('did-finish-load', () => {
                const copts = {
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

        const run = () => {
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
        };

        if (!process.env.PRODUCTION_MODE) {
            app.on('ready', () => {
                app.on('window-all-closed', windowAllClosed);
                if (app_register.regist(app)) {
                    run();
                }
            });
        } else {
            run();
        }
    });
};

if (!process.env.PRODUCTION_MODE) {
    startup();
} else {
    module.exports = {
        startup: startup,
        teardown: windowAllClosed
    };
}