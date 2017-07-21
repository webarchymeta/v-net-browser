import React from 'react';

const pathlib = require('path');

const BrowserPageSearch = React.createClass({
    componentDidUpdate: function (prevProps) {
        if (!prevProps.isActive && this.props.isActive)
            this.refs.input.focus()
    },
    shouldComponentUpdate: function (nextProps, nextState) {
        return (this.props.isActive != nextProps.isActive)
    },
    onKeyDown: function (e) {
        if (e.keyCode == 13) {
            e.preventDefault()
            this.props.onPageSearch(e.target.value)
        }
    },
    render: function () {
        return <div id="browser-page-search" className={this.props.isActive ? 'visible' : 'hidden'}>
            <input ref="input" type="text" placeholder="Search..." onKeyDown={this.onKeyDown} />
        </div>
    }
})

const BrowserPageStatus = React.createClass({
    render: function () {
        var status = this.props.page.statusText
        if (!status && this.props.page.isLoading)
            status = 'Loading...'
        return <div id="browser-page-status" className={status ? 'visible' : 'hidden'}>{status}</div>
    }
})

function webviewHandler(self, fnName) {
    return function (e) {
        if (self.props[fnName])
            self.props[fnName](e, self.props.page, self.props.pageIndex)
    }
}

const webviewEvents = {
    'load-commit': 'onLoadCommit',
    'did-start-loading': 'onDidStartLoading',
    'did-stop-loading': 'onDidStopLoading',
    'did-finish-load': 'onDidFinishLoading',
    'did-fail-load': 'onDidFailLoad',
    'did-get-response-details': 'onDidGetResponseDetails',
    'did-get-redirect-request': 'onDidGetRedirectRequest',
    'dom-ready': 'onDomReady',
    'page-title-set': 'onPageTitleSet',
    'close': 'onClose',
    'destroyed': 'onDestroyed',
    'ipc-message': 'onIpcMessage',
    'console-message': 'onConsoleMessage',
    'new-window': 'onOpenNewWindow'
};

function resize() {
    Array.prototype.forEach.call(document.querySelectorAll('webview'), function (webview) {
        var obj = webview && webview.querySelector('::shadow object')
        if (obj) {
            obj.style.height = (window.innerHeight - 59 - 28) + 'px' // -61 to adjust for the tabs and navbar regions
        }
    })
}

const BrowserPage = React.createClass({
    componentDidMount: function () {
        // setup resize events
        window.addEventListener('resize', resize);
        // attach webview events
        for (var k in webviewEvents) {
            this.refs.webview.addEventListener(k, webviewHandler(this, webviewEvents[k]));
        }
        setTimeout(resize, 1);
        // set location, if given
        if (this.props.page.location) {
            this.navigateTo(this.props.page.location);
        }
        Array.prototype.forEach.call(document.querySelectorAll('webview'), function (webview) {
            webview && webview.setAttribute('plugins', 'plugins');
        })
    },
    componentWillUnmount: function () {
        window.removeEventListener('resize', resize)
    },

    navigateTo: function (l) {
        var webview = this.refs.webview
        webview.setAttribute('src', l)
    },

    onPageSearch: function (query) {
        this.refs.webview.executeJavaScript('window.find("' + query + '", 0, 0, 1)')
    },

    webviewRef: function (wv) {
        wv.setAttribute('plugins', 'plugins');
    },

    render: function () {
        return <div id="browser-page" className={this.props.isActive ? 'visible' : 'hidden'}>
            <BrowserPageSearch isActive={this.props.page.isSearching} onPageSearch={this.onPageSearch} />
            <webview ref="webview" preload="./preload/main.js" onContextMenu={e => this.props.onContextMenu(e, this.props.page, this.props.pageIndex)} />
            <BrowserPageStatus page={this.props.page} />
        </div>
    }
});

export default BrowserPage;