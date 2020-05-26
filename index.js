const {
    app,
    Menu,
    MenuItem,
    Tray,
    dialog
} = require('electron'),
    path = require('path'),
    os = require('os'),
    child_proc = require('child_process');

const refresh_seconds = 10;

const
    config = require('./config.json'),
    booter = new(require('./libs/bootstrapper'))({
        refresh_seconds: refresh_seconds
    });

if (config.production_mode && config.packaged) {
    const cdir = path.dirname(process.execPath);
    if (process.cwd() !== cdir) {
        process.chdir(cdir);
    }
}

let tray = null;
let mainEntry = undefined;

if (!process.env.PRODUCTION_MODE) {
    const gotTheLock = app.requestSingleInstanceLock();
    if (!gotTheLock) {
        app.quit();
        return;
    } else {
        app.on('second-instance', (cmdl, wkdir) => {
            if (global.mainWindow) {
                if (global.mainWindow.isMinimized())
                    global.mainWindow.restore();
                global.mainWindow.focus();
            }
        });
    }
}

const launcher = function(m, w, e) {
    const gw = this;
    if (!gw.serving)
        return;
    if (gw.auth_required) {
        dialog.showErrorBox('Stop', 'The current browser does not support going through user authenticated V-NET gateway port!');
        return;
    }
    const child_opts = {
        cwd: process.cwd(),
        detached: false,
        shell: false,
        env: {}
    };
    if (gw.name) {
        child_opts.env.CONTEXT_TITLE = gw.name;
        child_opts.env.SOCKS5_ADDRESS = gw.answers[0].targets[0];
        child_opts.env.SOCKS5_PORT = gw.answers[0].port;
    };
    const keys = Object.keys(process.env);
    keys.forEach(k => {
        child_opts.env[k] = process.env[k];
    });
    if (!config.production_mode) {
        gw.proc = child_proc.spawn(path.join(process.cwd(), 'node_modules/electron/dist/electron' + (os.platform() === 'win32' ? '.exe' : '')), ['main-entry.js'], child_opts);
    } else {
        child_opts.env.PRODUCTION_MODE = true;
        if (!config.packaged) {
            gw.proc = child_proc.spawn(path.join(process.cwd(), 'node_modules/electron/dist/electron' + (os.platform() === 'win32' ? '.exe' : '')), ['index.js'], child_opts);
        } else {
            gw.proc = child_proc.spawn(path.join(process.cwd(), config.package_name + (os.platform() === 'win32' ? '.exe' : '')), [], child_opts);
        }
    }
    gw.proc.on('error', err => {
        console.log(err);
    });
    gw.proc.on('exit', function(code, sig) {
        this.started = false;
        this.proc = undefined;
        console.log(`process exited with code ${code}, sig: ${sig}`);
    }.bind(gw));
    if (gw.proc.stdout) {
        gw.proc.stdout.on('data', (data) => {
            console.log(`local-app: ${data}`);
        });
        gw.proc.stderr.on('data', (data) => {
            console.error(`local-app: ${data}`);
        });
    }
    gw.started = true;
};

let gateway_ports = [];
let last_update = undefined;

app.on('window-all-closed', () => {
    if (mainEntry) {
        mainEntry.teardown();
    }
});

const updater = () => {
    return booter.update_ports().then(r => {
        const old_ports = gateway_ports.map(p => p);
        gateway_ports = [];
        last_update = (new Date()).getTime();
        r.ports.forEach(gwp => {
            const old = old_ports.find(p => p.name === gwp.name);
            if (old) {
                gwp.proc = old.proc;
                gwp.started = old.started;
            }
            gateway_ports.push(gwp);
        });
        if (r.more) {
            r.more.on('more', function(gwp) {
                const old = this.find(p => p.name === gwp.name);
                if (old) {
                    gwp.proc = old.proc;
                    gwp.started = old.started;
                }
                gateway_ports.push(gwp);
            }.bind(old_ports));
        }
        setTimeout(function() {
            if (this.more) {
                this.more.removeAllListeners('more');
                this.more = undefined;
            }
            booter.close();
        }.bind(r), 10000);
    });
};

const local_browser = {
    started: false
};

app.on('ready', () => {
    if (!process.env.PRODUCTION_MODE) {
        booter.update_ports().then(r => {
            last_update = (new Date()).getTime();
            const getMenu = gw_lst => {
                const contextMenu = new Menu();
                contextMenu.append(new MenuItem({
                    icon: __dirname + '/images/blue-dot.png',
                    label: 'Local Browsing',
                    sublabel: 'Start browsing local resources ...',
                    click: launcher.bind(local_browser)
                }));
                contextMenu.append(new MenuItem({
                    type: 'separator'
                }));
                gw_lst.sort((a, b) => a.name > b.name ? 1 : -1).filter(gw => gw.serving).forEach(gw => {
                    contextMenu.append(new MenuItem({
                        icon: gw.auth_required ? __dirname + '/images/green-locked-dot.png' : __dirname + '/images/green-dot.png',
                        label: gw.name + (gw.netname ? ' in [' + gw.netname + ']' : ''),
                        sublabel: gw.descr || ' ... ',
                        click: launcher.bind(gw)
                    }));
                });
                contextMenu.append(new MenuItem({
                    type: 'separator'
                }));
                contextMenu.append(new MenuItem({
                    label: 'Exit',
                    click: (m, w, e) => {
                        app.quit();
                    }
                }));
                return contextMenu;
            };
            r.ports.forEach(gwp => {
                gateway_ports.push(gwp);
            });
            r.more.on('more', gwp => {
                gateway_ports.push(gwp);
            });
            tray = new Tray(__dirname + '/images/main-icon.png');
            tray.on('click', (e, b) => {
                const now = (new Date()).getTime();
                if (now - last_update > refresh_seconds * 1000) {
                    updater().then(() => {
                        tray.setContextMenu(getMenu(gateway_ports));
                        tray.popUpContextMenu();
                    });
                } else {
                    tray.setContextMenu(getMenu(gateway_ports));
                    tray.popUpContextMenu();
                }
            });
            tray.on('right-click', e => {
                e.preventDefault();
            });
            tray.setToolTip('V-NET Trans-LAN Browser');
            setTimeout(function() {
                if (this.more) {
                    this.more.removeAllListeners('more');
                    this.more = undefined;
                }
                booter.close();
            }.bind(this), 10000);
        });
    } else {
        mainEntry = require('./main-entry');
        mainEntry.startup();
    }
});