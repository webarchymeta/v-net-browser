'use strict';

import React from 'react';

const max_title_size = 12;

const short_title = title => {
    if (title.length < max_title_size) {
        return { trunc: false, value: title };
    } else {
        if (title.indexOf('?') > -1) {
            title = title.substr(0, title.indexOf('?'));
        }
        if (title.length > max_title_size) {
            title = title.substr(0, max_title_size) + '...';
        }
        return { trunc: true, value: title };
    }
};

const BrowserTab = React.createClass({
    render: function () {
        const title = this.props.page.isLoading ? 'loading' : this.props.page.title;
        const stitle = short_title(title);
        return <div className={this.props.isActive ? 'active' : ''} onClick={this.props.onClick} onContextMenu={this.props.onContextMenu}>
            <a onClick={this.props.onClose}><i className="fa fa-close" /></a>
            <a title={stitle.trunc ? title : undefined} className="title">
                <span>
                    {stitle.value}
                    {this.props.page.isLoading ? <span>&nbsp;</span> : undefined}
                    {this.props.page.isLoading ? <i className="fa fa-spinner fa-pulse" /> : undefined}
                </span>
            </a>
        </div>
    }
});

const BrowserTabs = React.createClass({
    render: function () {
        var self = this
        return <div id="browser-tabs">
            <a className="close" onClick={this.props.onClose}><i className="fa fa-circle" /></a>
            <a className="minimize" onClick={this.props.onMinimize}><i className="fa fa-circle" /></a>
            <a className="maximize" onClick={this.props.onMaximize}><i className="fa fa-circle" /></a>
            {this.props.pages.map(function (page, i) {
                if (!page)
                    return
                function onClick(e) { self.props.onTabClick(e, page, i) }
                function onContextMenu(e) { self.props.onTabContextMenu(e, page, i) }
                function onClose(e) { e.preventDefault(); e.stopPropagation(); self.props.onTabClose(e, page, i) }
                return <BrowserTab key={'browser-tab-' + i} isActive={self.props.currentPageIndex == i} page={page} onClick={onClick} onContextMenu={onContextMenu} onClose={onClose} />
            })}
            <a className="newtab" onClick={this.props.onNewTab}><i className="fa fa-plus" /></a>
        </div>
    }
});

export default BrowserTabs;

