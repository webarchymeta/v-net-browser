const {
    BrowserWindow,
    app,
    ipcMain
} = require('electron'),
    crypto = require('crypto'),
    inter_proc_ipc = require('node-ipc');

let mainWindow = null;

if (process.env.SOCKS5_ADDRESS) {
    app.commandLine.appendSwitch('proxy-server', 'socks5://' + process.env.SOCKS5_ADDRESS + ':' + process.env.SOCKS5_PORT);
    if (!process.env.SOCKS5_LOCAL_DNS) {
        app.commandLine.appendSwitch('host-resolver-rules', 'MAP * 0.0.0.0, EXCLUDE ' + process.env.SOCKS5_ADDRESS);
    }
}

const get_app_id = () => {
    let md5 = crypto.createHash('md5');
    md5.update(__filename.toLowerCase());
    return md5.digest('hex');
};

app.on('window-all-closed', function() {
    inter_proc_ipc.of.inter_app_services.emit('socks-client-status', {
        id: get_app_id(),
        pid: process.pid,
        started: false
    });
    if (process.platform != 'darwin') {
        app.quit();
    }
});

const register_app = () => {
    inter_proc_ipc.config.id = 'socks_app_register';
    inter_proc_ipc.config.retry = 1500;
    inter_proc_ipc.connectTo('inter_app_services', () => {
        inter_proc_ipc.of.inter_app_services.on('connect', () => {
            inter_proc_ipc.log('## connected to inter_app_services ##'.rainbow, inter_proc_ipc.config.delay);
            let data = {
                id: get_app_id(),
                categ: 'socks',
                type: process.env.APP_TYPE || 'browser',
                runtime: 'electron',
                name: app.getName(),
                appPath: __dirname,
                pid: process.pid,
                started: true,
            };
            inter_proc_ipc.of.inter_app_services.emit('socks-client-register', data);
        });
        inter_proc_ipc.of.inter_app_services.on('disconnect', () => {
            inter_proc_ipc.log('disconnected from socks_app_register'.notice);
        });
        inter_proc_ipc.of.inter_app_services.on('socks-client-register-ack', (data) => {
            inter_proc_ipc.log('got a message from socks_app_register : '.debug, data);
        });
    });
};

app.on('ready', () => {
    register_app();
    mainWindow = new BrowserWindow({
        width: 1530,
        height: 920,
        frame: false
    });
    //mainWindow.openDevTools();
    mainWindow.loadURL('file://' + require('path').join(__dirname, 'browser.html'));
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
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
});