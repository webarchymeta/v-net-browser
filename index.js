const {
    app,
    Menu,
    MenuItem,
    Tray
} = require('electron'),
    path = require('path'),
    child_proc = require('child_process');

const refresh_seconds = 10;

const
    booter = new(require(__dirname + '/libs/bootstrapper'))({
        refresh_seconds: refresh_seconds
    });

let tray = null;

const shouldQuit = app.makeSingleInstance((argv, wkdir) => {
    if (tray) {

    }
});

if (shouldQuit) {
    app.quit();
    return;
}

const launcher = function(m, w, e) {
    const gw = this;
    if (gw.started)
        return;
    let socks5_address = gw.answers[0].targets[0];
    const child_opts = {
        cwd: process.cwd(),
        detached: false,
        shell: false,
        env: {
            CONTEXT_TITLE: gw.name,
            SOCKS5_ADDRESS: socks5_address,
            SOCKS5_PORT: gw.answers[0].port
        }
    };
    const keys = Object.keys(process.env);
    keys.forEach(k => {
        child_opts.env[k] = process.env[k];
    });
    gw.proc = child_proc.spawn(path.join(process.cwd(), 'node_modules/.bin/electron.cmd'), ['main-entry.js'], child_opts);
    gw.proc.on('error', err => {
        console.log(err);
    });
    gw.proc.on('exit', function(code, sig) {
        gw.started = false;
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
};

let gateway_ports = [];
let last_update = undefined;

app.on('window-all-closed', () => {
    app_register.close();
    stateUpdator.flush().then(() => {
        return mainDB.close().then(() => {
            if (process.platform != 'darwin') {
                app.quit();
            }
        });
    });
});

const updator = () => {
    return booter.update_ports().then(r => {
        gateway_ports = [];
        last_update = (new Date()).getTime();
        r.ports.forEach(gwp => {
            gateway_ports.push(gwp);
        });
        if (r.more) {
            r.more.on('more', (gwp) => {
                gateway_ports.push(gwp);
            });
        }
    });
};

app.on('ready', () => {
    booter.update_ports().then(r => {
        last_update = (new Date()).getTime();
        const getMenu = (gw_lst) => {
            const contextMenu = new Menu();
            gw_lst.sort((a, b) => a.name > b.name ? 1 : -1).forEach(gw => {
                contextMenu.append(new MenuItem({
                    icon: 'images/green-dot.png',
                    label: gw.name,
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
        r.more.on('more', (gwp) => {
            gateway_ports.push(gwp);
        });
        tray = new Tray('images/main-icon.png');
        tray.on('click', (e, b) => {
            const now = (new Date()).getTime();
            if (now - last_update > refresh_seconds * 1000) {
                updator().then(() => {
                    tray.setContextMenu(getMenu(gateway_ports));
                    tray.popUpContextMenu();
                });
            } else {
                tray.setContextMenu(getMenu(gateway_ports));
                tray.popUpContextMenu();
            }
        });
        tray.on('right-click', (e) => {
            e.preventDefault();
        });
        tray.setToolTip('1-NET Trans-LAN Browser');
        setTimeout(() => {
            r.more.removeAllListeners('more');
            r.more = undefined;
            booter.close();
        }, 10000);
    });
});