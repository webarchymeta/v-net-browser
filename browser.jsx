'use strict'

import React from 'react';
import ReactDOM from 'react-dom';
import BrowserTabs from './browser-tabs.jsx';
import BrowserNavbar from './browser-navbar.jsx';
import BrowserPage from './browser-page.jsx';

const { remote, ipcRenderer } = require('electron');
const { Menu, MenuItem, clipboard } = remote;

const ifaces = require('os').networkInterfaces();
const subnets = [];
Object.keys(ifaces).forEach(key => {
    ifaces[key].forEach(ip => {
        if (!ip.internal && 'ipv4' === ip.family.toLowerCase()) {
            subnets.push(ip.address.substr(0, ip.address.lastIndexOf('.') + 1));
        }
    });
});

const mdns = new (require('multicast-dns'))({
    port: 0,
    subnets: subnets,
    loopback: false
});

const urllib = require('url');

const onenet_gateway_url_pattern = /\.gw-master\.local(\/.*)?\s*$/i;

function createPageObject(location, frameName) {
    return {
        location: location || process.env.START_URL,
        statusText: false,
        title: 'new tab',
        frameName: frameName,
        isLoading: false,
        isSearching: false,
        canGoBack: false,
        canGoForward: false,
        canRefresh: false
    }
}

ipcRenderer.on('runtime-context-update', (e, context) => {
    console.log(context);
    window.__frame_element.state.runtime_context = context;
    window.__frame_element.setState(window.__frame_element.state);
});

const mdns_cache = {};

const mdns_rec = function (data) {
    const self = this;
    self.location = data.location;
    self.failed = !data.address;
    self.address = data.address;
    self.port = data.port;
    self.created = (new Date()).getTime();
    self.resolve = () => {
        if (!self.failed) {
            const url = urllib.parse(self.location);
            url.href = undefined;
            url.host = undefined;
            url.hostname = self.address;
            url.port = self.port;
            return urllib.format(url);
        } else {
            return self.location;
        }
    };
};

const BrowserChrome = React.createClass({
    getInitialState: function () {
        return {
            pages: [createPageObject()],
            currentPageIndex: 0
        };
    },
    componentWillMount: function () {
        window.__frame_element = this;
        // bind handlers to this object
        for (var k in this.tabHandlers)
            this.tabHandlers[k] = this.tabHandlers[k].bind(this);
        for (var k in this.navHandlers)
            this.navHandlers[k] = this.navHandlers[k].bind(this);
        for (var k in this.pageHandlers)
            this.pageHandlers[k] = this.pageHandlers[k].bind(this);
    },
    componentDidMount: function () {
        // attach webview events
        for (var k in this.webviewHandlers)
            this.getWebView().addEventListener(k, this.webviewHandlers[k].bind(this));

        // attach keyboard shortcuts
        // :TODO: replace this with menu hotkeys
        var self = this;
        document.body.addEventListener('keydown', function (e) {
            if (e.metaKey && e.keyCode == 70) { // cmd+f
                // start search
                self.getPageObject().isSearching = true;
                self.setState(self.state);

                // make sure the search input has focus
                self.getPage().querySelector('#browser-page-search input').focus();
            } else if (e.keyCode == 27) { // esc
                // stop search
                self.getPageObject().isSearching = false;
                self.setState(self.state);
            }
        });
    },

    getWebView: function (i) {
        i = (typeof i == 'undefined') ? this.state.currentPageIndex : i;
        return this.refs['page-' + i].refs.webview;
    },
    getPage: function (i) {
        i = (typeof i == 'undefined') ? this.state.currentPageIndex : i;
        return this.refs['page-' + i];
    },
    getPageObject: function (i) {
        i = (typeof i == 'undefined') ? this.state.currentPageIndex : i;
        return this.state.pages[i];
    },

    createTab: function (location, frameName) {
        this.state.pages.push(createPageObject(location, frameName));
        this.setState({ pages: this.state.pages, currentPageIndex: this.state.pages.length - 1 });
    },
    closeTab: function (pageIndex) {
        // last tab, full reset
        if (this.state.pages.filter(Boolean).length == 1)
            return this.setState({ pages: [createPageObject()], currentPageIndex: 0 });

        this.state.pages[pageIndex] = null;
        this.setState({ pages: this.state.pages });

        // find the nearest adjacent page to make active
        if (this.state.currentPageIndex == pageIndex) {
            for (var i = pageIndex; i >= 0; i--) {
                if (this.state.pages[i])
                    return this.setState({ currentPageIndex: i });
            }
            for (var i = pageIndex; i < this.state.pages.length; i++) {
                if (this.state.pages[i])
                    return this.setState({ currentPageIndex: i });
            }
        }
    },
    tabContextMenu: function (pageIndex) {
        var self = this;
        var menu = new Menu();
        menu.append(new MenuItem({ label: 'New Tab', click: function () { self.createTab() } }));
        menu.append(new MenuItem({ label: 'Duplicate', click: function () { self.createTab(self.getPageObject(pageIndex).location) } }));
        menu.append(new MenuItem({ type: 'separator' }));
        menu.append(new MenuItem({ label: 'Close Tab', click: function () { self.closeTab(pageIndex) } }));
        menu.popup(remote.getCurrentWindow());
    },
    locationContextMenu: function (el) {
        var self = this;
        var menu = new Menu();
        menu.append(new MenuItem({
            label: 'Copy', click: function () {
                clipboard.writeText(el.value)
            }
        }));
        menu.append(new MenuItem({
            label: 'Cut', click: function () {
                clipboard.writeText(el.value.slice(el.selectionStart, el.selectionEnd));
                self.getPageObject().location = el.value.slice(0, el.selectionStart) + el.value.slice(el.selectionEnd);
            }
        }));
        menu.append(new MenuItem({
            label: 'Paste', click: function () {
                var l = el.value.slice(0, el.selectionStart) + clipboard.readText() + el.value.slice(el.selectionEnd);
                self.getPageObject().location = l;
            }
        }));
        menu.append(new MenuItem({
            label: 'Paste and Go', click: function () {
                var l = el.value.slice(0, el.selectionStart) + clipboard.readText() + el.value.slice(el.selectionEnd);
                self.getPageObject().location = l;
                self.getPage().navigateTo(l);
            }
        }))
        menu.popup(remote.getCurrentWindow())
    },
    webviewContextMenu: function (e) {
        var self = this;
        var menu = new Menu();
        if (e.href) {
            menu.append(new MenuItem({ label: 'Open Link in New Tab', click: function () { self.createTab(e.href) } }));
            menu.append(new MenuItem({ label: 'Copy Link Address', click: function () { clipboard.writeText(e.href) } }));
        }
        if (e.img) {
            menu.append(new MenuItem({ label: 'Save Image As...', click: function () { alert('todo') } }));
            menu.append(new MenuItem({ label: 'Copy Image URL', click: function () { clipboard.writeText(e.img) } }));
            menu.append(new MenuItem({ label: 'Open Image in New Tab', click: function () { self.createTab(e.img) } }));
        }
        if (e.hasSelection)
            menu.append(new MenuItem({ label: 'Copy', click: function () { self.getWebView().copy() } }));
        menu.append(new MenuItem({ label: 'Select All', click: function () { self.getWebView().selectAll() } }));
        menu.append(new MenuItem({ type: 'separator' }));
        menu.append(new MenuItem({
            label: 'Inspect Element', click: function () {
                if (window.currentContextMenuPos) {
                    self.getWebView().inspectElement(window.currentContextMenuPos.x, window.currentContextMenuPos.y);
                }
            }
        }));
        menu.popup(remote.getCurrentWindow());
    },
    tabHandlers: {
        onNewTab: function () {
            this.createTab();
        },
        onTabClick: function (e, page, pageIndex) {
            this.setState({ currentPageIndex: pageIndex });
        },
        onTabContextMenu: function (e, page, pageIndex) {
            this.tabContextMenu(pageIndex);
        },
        onTabClose: function (e, page, pageIndex) {
            this.closeTab(pageIndex);
        },
        onMaximize: function () {
            if (remote.getCurrentWindow())
                remote.getCurrentWindow().maximize();
            else
                remote.unmaximize();
        },
        onMinimize: function () {
            remote.getCurrentWindow().minimize();
        },
        onClose: function () {
            remote.getCurrentWindow().close();
        }
    },
    navHandlers: {
        onClickHome: function () {
            this.getWebView().goToIndex(0);
        },
        onClickBack: function () {
            this.getWebView().goBack();
        },
        onClickForward: function () {
            this.getWebView().goForward();
        },
        onClickRefresh: function () {
            this.getWebView().reload();
        },
        onClickBundles: function () {
            var location = urllib.parse(this.getWebView().getURL()).path;
            this.getPage().navigateTo('/bundles/view.html#' + location);
        },
        onClickVersions: function () {
            var location = urllib.parse(this.getWebView().getURL()).path;
            this.getPage().navigateTo('/bundles/versions.html#' + location);
        },
        onClickSync: console.log.bind(console, 'sync'),
        onEnterLocation: function (location) {
            if (location.match(onenet_gateway_url_pattern)) {
                const rec = mdns_cache[location];
                const now = (new Date()).getTime();
                if (rec && (now - rec.created < 60 * 1000)) {
                    this.getPage().navigateTo(rec.resolve());
                } else {
                    const url = urllib.parse(location);
                    if (url.hostname.match(onenet_gateway_url_pattern)) {
                        ipcRenderer.send('mdns-query', { hostname: url.hostname });
                        ipcRenderer.once('mdns-query-ack', (e, r) => {
                            if (r.ok) {
                                url.host = undefined;
                                url.href = undefined;
                                url.hostname = r.response.address;
                                url.port = r.response.port;
                                mdns_cache[location] = new mdns_rec({
                                    location: location,
                                    address: url.hostname,
                                    port: url.port
                                });
                                this.getPage().navigateTo(urllib.format(url));
                            } else {
                                mdns_cache[location] = new mdns_rec({
                                    location: location
                                });
                                console.log(r.error);
                            }
                        });
                    } else {
                        this.getPage().navigateTo(location);
                    }
                }
            } else {
                this.getPage().navigateTo(location);
            }
        },
        onChangeLocation: function (location) {
            var page = this.getPageObject();
            page.location = location;
            this.setState(this.state);
        },
        onLocationContextMenu: function (e) {
            this.locationContextMenu(e.target);
        }
    },
    pageHandlers: {
        onDidStartLoading: function (e, page) {
            page.isLoading = true;
            page.title = false;
            this.setState(this.state);
        },
        onDomReady: function (e, page, pageIndex) {
            var webview = this.getWebView(pageIndex);
            page.canGoBack = webview.canGoBack();
            page.canGoForward = webview.canGoForward();
            page.canRefresh = true;
            this.setState(this.state);
        },
        onDidStopLoading: function (e, page, pageIndex) {
            // update state
            var webview = this.getWebView(pageIndex);
            page.statusText = false;
            page.location = webview.getURL();
            page.canGoBack = webview.canGoBack();
            page.canGoForward = webview.canGoForward();
            if (!page.title)
                page.title = page.location;
            page.isLoading = false;
            this.setState(this.state);
        },
        onPageTitleSet: function (e) {
            var page = this.getPageObject();
            page.title = e.title;
            page.location = this.getWebView().getURL();
            this.setState(this.state);
        },
        onContextMenu: function (e, page, pageIndex) {
            let pageIndx = typeof pageIndex === 'number' ? pageIndex : undefined;
            window.currentContextMenuPos = { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };
            this.getWebView(pageIndx).send('get-contextmenu-data', window.currentContextMenuPos);
        },
        onIpcMessage: function (e, page) {
            if (e.channel == 'status') {
                page.statusText = e.args[0];
                this.setState(this.state);
            }
            else if (e.channel == 'contextmenu-data') {
                this.webviewContextMenu(e.args[0]);
            }
        },
        onOpenNewWindow: function (e, page, pageIndex) {
            if (!e.frameName || e.frameName === '_plain') {
                this.createTab(e.url);
            } else {
                let ipage = this.state.pages.findIndex(p => p && p.frameName === e.frameName);
                if (ipage === -1) {
                    this.createTab(e.url, e.frameName);
                } else {
                    let page = this.getPageObject(ipage);
                    page.location = e.url;
                    this.state.currentPageIndex = ipage;
                    this.setState(this.state);
                }
            }
        }
    },
    render: function () {
        const self = this;
        return <div>
            <BrowserTabs ref="tabs" pages={this.state.pages} currentPageIndex={this.state.currentPageIndex} {...this.tabHandlers} />
            <BrowserNavbar ref="navbar" {...this.navHandlers} page={this.state.pages[this.state.currentPageIndex]} />
            {this.state.pages.map((page, i) => {
                if (!page)
                    return
                return <BrowserPage ref={'page-' + i} key={'page-' + i} {...self.pageHandlers} page={page} pageIndex={i} isActive={i == self.state.currentPageIndex} />
            })}
            {this.state.runtime_context && this.state.runtime_context.has_context &&
                <div className='runtime-context'>
                    <table>
                        <tbody>
                            <tr>
                                <td><span>To: {this.state.runtime_context.context_title}</span></td>
                                <td><span>Proxy: socks5://{this.state.runtime_context.socks5_address}:{this.state.runtime_context.socks5_port}</span>                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            }
        </div>
    }
})

// render
ReactDOM.render(
    <BrowserChrome />,
    document.getElementById('browser-chrome')
)