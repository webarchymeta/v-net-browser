'use strict';

const
    events = require('events'),
    mdns_client = require('./mdns-client');

const ipv4_node = '(?:[01]?[0-9]?[0-9]|2[0-4][0-9]|25[0-5])';
const ipv6_node = '[0-9a-f]{0,4}';

const ipv4_address_reg = new RegExp('^\\s*' + ipv4_node + '\\.' + ipv4_node + '\\.' + ipv4_node + '\\.' + ipv4_node + '\\s*$');
const ipv6_address_reg = new RegExp('(?:' + ipv6_node + ':){2,8}(?:' + ipv6_node + ')');

const defer = () => {
    let resolve, reject;
    const promise = new Promise((_1, _2) => {
        resolve = _1;
        reject = _2;
    });
    return {
        resolve: resolve,
        reject: reject,
        promise: promise
    };
};

const gateway_port = function (data) {
    const self = this;
    self.type = data.type;
    self.id;
    self.account_id;
    self.gateway_id;
    self.name = data.name;
    self.host;
    self.tags;
    self.descr = '';
    self.auth_required = false;
    self.account_name;
    self.master_api_port;
    self.username;
    self.answers = [];
    self.started = data.started;
    self.serving = false;
    data.answers.forEach(a => {
        if (data.type === 'SRV') {
            if (a.target) {
                self.answers.push({
                    targets: a.target.split(',').filter(t => !!t.trim()).map(t => t.trim()),
                    port: a.port
                });
            } else {
                if (a.id) {
                    if (!a.aid) {
                        const ss = a.ss ? a.ss.split(':') : undefined;
                        if (!ss) {
                            self.active = a.started;
                            self.started = a.started;
                            self.serving = self.answers[0].targets[0] !== 'stopped';
                            if (self.serving && !self.started) {
                                self.started = true;
                            }
                        } else {
                            self.active = ss[0] === '1';
                            self.started = ss[1] === '1';
                            self.serving = ss[2] === '1';
                        }
                        self.id = a.id;
                        self.pipe_type = a.kind === 'socks' ? 'socks-webrtc' : a.kind;
                        self.auth_required = a.auth;
                        self.tags = a.tags;
                        self.descr = a.descr;
                    } else {
                        self.gateway_id = a.gid;
                        self.peer_gw_id = a.pid;
                        self.account_id = a.aid;
                        self.account_name = a.nn;
                        self.master_api_port = a.mp;
                        self.host = a.host;
                    }
                } else if (a instanceof Uint8Array) {
                    const str = Buffer.from(a).toString('utf8');
                    try {
                        const rec = JSON.parse(str);
                        if (!rec.aid) {
                            const ss = rec.ss ? rec.ss.split(':') : undefined;
                            if (!ss) {
                                self.active = rec.started;
                                self.started = rec.started;
                                self.serving = self.answers[0].targets[0] !== 'stopped';
                                if (self.serving && !self.started) {
                                    self.started = true;
                                }
                            } else {
                                self.active = ss[0] === '1';
                                self.started = ss[1] === '1';
                                self.serving = ss[2] === '1';
                            }
                            self.id = rec.id;
                            self.pipe_type = rec.kind === 'socks' ? 'socks-webrtc' : rec.kind;
                            self.auth_required = rec.auth;
                            self.tags = rec.tags;
                            self.descr = rec.descr;
                        } else {
                            self.gateway_id = rec.gid;
                            self.account_id = rec.aid;
                            self.peer_gw_id = rec.pid;
                            self.account_name = rec.nn;
                            self.master_api_port = rec.mp;
                            self.host = rec.host;
                        }
                    } catch (ex) {
                        self.descr = str;
                    }
                } else if (a instanceof String) {
                    try {
                        const rec = JSON.parse(a);
                        if (!rec.aid) {
                            const ss = rec.ss ? rec.ss.split(':') : undefined;
                            if (!ss) {
                                self.active = rec.started;
                                self.started = rec.started;
                                self.serving = self.answers[0].targets[0] !== 'stopped';
                                if (self.serving && !self.started) {
                                    self.started = true;
                                }
                            } else {
                                self.active = ss[0] === '1';
                                self.started = ss[1] === '1';
                                self.serving = ss[2] === '1';
                            }
                            self.id = rec.id;
                            self.pipe_type = rec.kind === 'socks' ? 'socks-webrtc' : rec.kind;
                            self.auth_required = rec.auth;
                            self.tags = rec.tags;
                            self.descr = rec.descr;
                        } else {
                            self.gateway_id = rec.gid;
                            self.peer_gw_id = rec.pid;
                            self.account_id = rec.aid;
                            self.account_name = rec.nn;
                            self.master_api_port = rec.mp;
                            self.host = rec.host;
                        }
                    } catch (ex) {
                        self.descr = a;
                    }
                } else {
                    const str = a.toString('utf8');
                    try {
                        const rec = JSON.parse(str);
                        if (!rec.aid) {
                            const ss = rec.ss ? rec.ss.split(':') : undefined;
                            if (!ss) {
                                self.active = rec.started;
                                self.started = rec.started;
                                self.serving = self.answers[0].targets[0] !== 'stopped';
                                if (self.serving && !self.started) {
                                    self.started = true;
                                }
                            } else {
                                self.active = ss[0] === '1';
                                self.started = ss[1] === '1';
                                self.serving = ss[2] === '1';
                            }
                            self.id = rec.id;
                            self.pipe_type = rec.kind === 'socks' ? 'socks-webrtc' : rec.kind;
                            self.auth_required = rec.auth;
                            self.tags = rec.tags;
                            self.descr = rec.descr;
                        } else {
                            self.gateway_id = rec.gid;
                            self.peer_gw_id = rec.pid;
                            self.account_id = rec.aid;
                            self.account_name = rec.nn;
                            self.master_api_port = rec.mp;
                            self.host = rec.host;
                        }
                    } catch (ex) {
                        self.descr = ex.message; //str;
                    }
                }
            }
        } else {
            self.answers.push(a);
        }
    });
    self.add_answers = alst => {
        alst.forEach(a => {
            if (data.type === 'SRV') {
                self.answers.push({
                    targets: a.target.split(',').filter(t => !!t.trim()).map(t => t.trim()),
                    port: a.port
                });
            } else {
                self.answers.push(a);
            }
        });
    };
    self.toJson = opts => {
        const jdata = {
            type: self.type,
            id: self.id,
            gateway_id: self.gateway_id,
            peer_gw_id: self.peer_gw_id,
            pipe_type: self.pipe_type,
            name: self.name,
            host: self.host,
            tags: self.tags,
            descr: self.descr,
            account_id: self.account_id,
            net_name: self.account_name,
            master_api_port: self.master_api_port,
            active: self.active,
            started: self.started,
            serving: self.serving,
            auth_required: self.auth_required
        };
        if (self.answers.length > 0) {
            const ip6s = self.answers[0].targets.filter(t => ipv6_address_reg.test(t));
            jdata.ip = self.answers[0].targets.filter(t => ipv4_address_reg.test(t))[0];
            if (ip6s.length > 0) {
                if (ip6s.length === 1) {
                    jdata.ip6 = ip6s[0];
                } else {
                    jdata.ip6 = ip6s.filter(a => a.indexOf('fd') === 0).length > 0 ? ip6s.filter(a => a.indexOf('fd') === 0)[0] : undefined;
                    if (!jdata.ip6) {
                        jdata.ip6 = ip6s.filter(a => a.indexOf('2') === 0).length > 0 ? ip6s.filter(a => a.indexOf('2') === 0)[0] : undefined;
                    }
                    if (!jdata.ip6) {
                        jdata.ip6 = ip6s.filter(a => a.indexOf('fe') === 0).length > 0 ? ip6s.filter(a => a.indexOf('fe') === 0)[0] : undefined;
                    }
                    if (!jdata.ip6) {
                        jdata.ip6 = ip6s[0];
                    }
                }
            }
            jdata.port = self.answers[0].port;
        }
        if (jdata.auth_required && opts && opts.get_username) {
            jdata.username = self.username;
        }
        return jdata;
    };
};

const api = function (opts) {
    const self = this;
    const refresh_seconds = opts && opts.refresh_seconds ? opts.refresh_seconds : 10;

    let loading = false;
    let wait_list = [];
    let curr_list = [];
    let last_update = undefined;
    let dns = undefined;

    self.get_list = () => curr_list;

    self.is_loading = () => loading;

    self.update_ports = force_refresh => {
        const now = new Date();
        if (!force_refresh && last_update && (now.getTime() - last_update) < refresh_seconds * 1000) {
            return Promise.resolve({
                ports: curr_list
            });
        } else {
            if (loading) {
                const tsk = defer();
                wait_list.push(tsk);
                return tsk.promise;
            }
            loading = true;
            curr_list = [];
            if (dns) {
                dns.query_done();
            }
            dns = new mdns_client();
            return dns.query(['*.gw-port.local'], 'SRV').then(r => {
                r[0].results && r[0].results.forEach(p => {
                    if (p.answers.length > 0) {
                        curr_list.push(new gateway_port(p));
                    }
                });
            }).then(() => {
                const rec = {
                    ports: curr_list.map(g => g.toJson())
                };
                wait_list.forEach(p => {
                    p.resolve(rec);
                });
                loading = false;
                wait_list = [];
                last_update = now.getTime();
                return rec;
                //return dns.query(curr_list.map(p => p.name), 'TXT').then(add_descr);
            });
        }
    };

    self.close = () => {
        if (dns) {
            dns.query_done();
            dns = undefined;
            loading = false;
        }
    };
};

module.exports = api;