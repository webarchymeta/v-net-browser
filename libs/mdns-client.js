'use strict';

const
    os = require('os'),
    events = require('events'),
    mdnsAPI = require('multicast-dns');

const client = function (_opts) {

    const self = this;
    const opts = _opts;
    const ifaces = os.networkInterfaces();
    const subnets = [];
    let curent_mdns = undefined;

    Object.keys(ifaces).forEach(key => {
        ifaces[key].forEach(ip => {
            if (!ip.internal && 'ipv4' === ip.family.toLowerCase()) {
                subnets.push({
                    prefix: ip.address.substr(0, ip.address.lastIndexOf('.') + 1)
                });
            }
        });
    });

    self.query = (patterns, type) => {
        return new Promise((resolve, reject) => {
            type = type || 'SRV';
            const mdns = new mdnsAPI({
                port: 0,
                subnets: subnets,
                loopback: true,
                client_only: true
            });
            curent_mdns = mdns;
            const questions = [];
            patterns.forEach(p => {
                questions.push({
                    type: type,
                    name: p
                });
            });
            const res_handler = res => {
                const add_answers = (q, answers) => {
                    q.frag_tbl = {};
                    answers.forEach(a => {
                        let r = q.results.find(r => r.name === a.name);
                        if (!r) {
                            r = {
                                type: type,
                                name: a.name,
                                answers: []
                            };
                            q.results.push(r);
                        }
                        if (a.type === 'SRV') {
                            if (a.data.target && !r.answers.find(_a => _a.target === a.data.target && _a.port === a.data.port)) {
                                r.answers.unshift(a.data);
                            }
                        } else {
                            const txt = a.data.toString('utf8');
                            if (/^\d+\/\d+:.+/.test(txt)) {
                                let frag = q.frag_tbl[a.name];
                                if (!frag) {
                                    frag = {
                                        recs: []
                                    };
                                    q.frag_tbl[a.name] = frag;
                                }
                                const idx = txt.indexOf(':');
                                const hdr = txt.substr(0, idx);
                                const seq = parseInt(hdr.substr(0, hdr.indexOf('/')));
                                const size = parseInt(hdr.substr(hdr.indexOf('/') + 1));
                                if (!frag.recs.find(t => t.seq === seq)) {
                                    frag.blocks = size;
                                    frag.recs.push({
                                        seq: seq,
                                        data: txt.substr(idx + 1)
                                    });
                                }
                            } else {
                                if (txt && !r.answers.find(_a => _a === txt)) {
                                    r.answers.push(txt);
                                }
                            }
                        }
                    });
                };
                if (res.type === 'response') {
                    questions.forEach(q => {
                        if (res.questions.length > 0 && res.questions[0].type === q.type && res.questions[0].name === q.name) {
                            if (res.answers && res.answers.length > 0) {
                                q.results = q.results || [];
                                add_answers(q, res.answers.filter(a => a.type === type || type === 'SRV' && a.type === 'TXT'));
                            }
                            if (res.additionals && res.additionals.length > 0) {
                                q.results = q.results || [];
                                add_answers(q, res.additionals.filter(a => a.type === type || type === 'SRV' && a.type === 'TXT'));
                            }
                        }
                    });
                }
            };
            mdns.on('response', res_handler);
            mdns.on('sender-ready', () => {
                mdns.query({
                    questions: questions
                });
                setTimeout(() => {
                    for (const q of questions) {
                        if (q.frag_tbl) {
                            if (q.results && Array.isArray(q.results)) {
                                for (const res of q.results) {
                                    const frag = q.frag_tbl[res.name];
                                    if (frag) {
                                        const data = frag.recs.sort((a, b) => {
                                            return a.seq - b.seq;
                                        }).reduce((s, f) => s + f.data, '');
                                        res.answers.push(data);
                                    }
                                }
                            }
                            delete q.frag_tbl;
                        }
                    }
                    resolve(questions);
                }, 1000 * (opts && opts.sample_seconds ? opts.sample_seconds : 1));
            });
        });
    };

    self.find = (name, type) => {
        return new Promise((resolve, reject) => {
            const mdns = new mdnsAPI({
                port: 0,
                subnets: subnets,
                loopback: true,
                client_only: true
            });
            const question = {
                type: type || 'SRV',
                name: name
            };
            const res_handler = res => {
                if (res.type === 'response') {
                    if (res.questions.length > 0 && res.questions[0].type === question.type && res.questions[0].name === question.name) {
                        mdns.destroy();
                        setTimeout(() => {
                            mdns.removeListener('response', res_handler);
                        }, 100);
                        if (res.answers && res.answers.length > 0 || res.additionals && res.additionals.length > 0) {
                            if (__timeout) {
                                clearTimeout(__timeout);
                                __timeout = undefined;
                            }
                            let srv_ip = res.answers[0].data.target;
                            const port = res.answers[0].data.port;
                            if (srv_ip.indexOf(',') > -1) {
                                srv_ip = gw_ip.substr(0, socks_ip.indexOf(','));
                            }
                            resolve({
                                address: srv_ip,
                                port: port
                            })
                        } else {
                            resolve();
                        }
                    }
                }
            };
            mdns.on('response', res_handler);
            mdns.on('sender-ready', () => {
                mdns.query({
                    questions: [question]
                });
                setTimeout(() => {
                    mdns.destroy();
                    mdns.removeListener('response', res_handler);
                    resolve();
                }, 1000 * (opts && opts.sample_seconds ? opts.sample_seconds : 1))
            });
        });
    };

    self.query_done = () => {
        if (curent_mdns) {
            curent_mdns.destroy();
            curent_mdns.removeAllListeners('response');
            curent_mdns.removeAllListeners('error');
            curent_mdns = undefined;
        }
    };
};

module.exports = client;