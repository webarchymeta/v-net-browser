'use strict';

const
    events = require('events'),
    dns_client = require(__dirname + '/dns-client');

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

const gateway_port = function(data) {
    const self = this;
    self.type = data.type;
    self.name = data.name;
    self.descr = '';
    self.auth_required = false;
    self.username;
    self.answers = [];
    self.started = false;
    self.serving = false;
    self.proc;
    data.answers.forEach(a => {
        if (data.type === 'SRV') {
            if (a.target) {
                self.answers.push({
                    targets: a.target.split(',').filter(t => !!t.trim()).map(t => t.trim()),
                    port: a.port
                });
                self.serving = self.answers[0].targets[0] !== 'stopped';
            } else {
                if (a instanceof Uint8Array) {
                    const str = Buffer.from(a).toString('utf8');
                    try {
                        const rec = JSON.parse(str);
                        self.auth_required = rec.auth;
                        self.descr = rec.descr;
                    } catch (ex) {
                        self.descr = str;
                    }
                } else if (a instanceof String) {
                    try {
                        const rec = JSON.parse(a);
                        self.auth_required = rec.auth;
                        self.descr = rec.descr;
                    } catch (ex) {
                        self.descr = a;
                    }
                } else {
                    const str = a.toString('utf8');
                    try {
                        const rec = JSON.parse(str);
                        self.auth_required = rec.auth;
                        self.descr = rec.descr;
                    } catch (ex) {
                        self.descr = str;
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
};

const api = function(opts) {
    const self = this;
    const refresh_seconds = opts && opts.refresh_seconds ? opts.refresh_seconds : 10;

    let loading = false;
    let wait_list = [];
    let curr_list = [];
    let last_update = undefined;
    let dns = undefined;

    self.get_list = () => curr_list;

    self.is_loading = () => loading;

    self.update_ports = (force_refresh) => {
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
            dns = new dns_client();
            return dns.query(['*.gw-port.local'], 'SRV').then(r => {
                r.results.forEach(p => {
                    if (p.answers.length > 0) {
                        curr_list.push(new gateway_port(p));
                    }
                });
                return r.more;
            }).then(more => {
                const evtSink = new events();
                const add_descr = tr => {
                    last_update = now.getTime();
                    tr.results.forEach(d => {
                        if (d.answers.length > 0 && d.answers[0]) {
                            const _r = curr_list.find(x => x.name === d.name);
                            if (_r) {
                                _r.descr = Buffer.from(d.answers[0]).toString('utf8');
                            }
                        }
                    });
                    const rec = {
                        ports: curr_list,
                        more: evtSink
                    };
                    wait_list.forEach(p => {
                        p.resolve(rec);
                    });
                    loading = false;
                    wait_list = [];
                    return rec;
                };
                more.on('more', p => {
                    if (p.answers.length > 0) {
                        curr_list.push(new gateway_port(p));
                    }
                });
                const rec = {
                    ports: curr_list,
                    more: evtSink
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