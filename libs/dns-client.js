'use strict';

const
    os = require('os'),
    events = require('events'),
    mdnsAPI = require('multicast-dns');

const client = function() {

    const self = this;
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
                use_group_ip: false,
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
            const results = [];
            let wait_for_more = false;
            let evtSink = undefined;
            const __timeout = setTimeout(() => {
                wait_for_more = true;
                evtSink = new events();
                resolve({
                    results: results,
                    more: evtSink
                });
            }, 1000);
            const res_handler = res => {
                const add_answers = (answers) => {
                    answers.forEach(a => {
                        let r = results.find(r => r.name === a.name);
                        if (!r) {
                            r = {
                                type: type,
                                name: a.name,
                                answers: []
                            };
                            results.push(r);
                        }
                        if (type === 'SRV') {
                            if (a.data.target !== 'stopped' && !r.answers.find(_a => _a.target === a.data.target && _a.port === a.data.port)) {
                                r.answers.push(a.data);
                                if (wait_for_more) {
                                    evtSink.emit('more', r);
                                }
                            }
                        } else {
                            if (a.data && !r.answers.find(_a => _a === a.data)) {
                                r.answers.push(a.data);
                                if (wait_for_more) {
                                    evtSink.emit('more', r);
                                }
                            }
                        }
                    });
                };
                if (res.type === 'response') {
                    questions.forEach(q => {
                        if (res.questions.length > 0 && res.questions[0].type === q.type && res.questions[0].name === q.name) {
                            if (res.answers && res.answers.length > 0) {
                                add_answers(res.answers.filter(a => a.type === type || type === 'SRV' && a.type === 'TXT'));
                            }
                            if (res.additionals && res.additionals.length > 0) {
                                add_answers(res.additionals.filter(a => a.type === type || type === 'SRV' && a.type === 'TXT'));
                            }
                        }
                    });
                }
            };
            mdns.on('response', res_handler);
            mdns.on('ready', () => {
                mdns.query({
                    questions: questions
                });
            });
        });
    };

    self.query_done = () => {
        if (curent_mdns) {
            curent_mdns.destroy();
            curent_mdns.removeAllListeners('response');
            curent_mdns = undefined;
        }
    };

    self.find = (name, type) => {
        return new Promise((resolve, reject) => {
            const mdns = new mdnsAPI()({
                port: 0,
                subnets: subnets,
                loopback: false,
                use_group_ip: false,
                client_only: true
            });
            const question = {
                type: type || 'SRV',
                name: name
            };
            const __timeout = setTimeout(() => {
                mdns.destroy();
                mdns.removeListener('response', res_handler);
                reslove();
            }, 1000);
            const res_handler = res => {
                if (res.type === 'response') {
                    if (res.questions.length > 0 && res.questions[0].type === question.type && res.questions[0].name === question.name) {
                        mdns.destroy();
                        setTimeout(() => {
                            mdns.removeListener('response', res_handler);
                        }, 100);
                        if (res.answers && res.answers.length > 0 || res.additionals && res.additionals.length > 0) {
                            clearTimeout(__timeout);
                            __timeout = undefined;
                            let gw_ip = res.answers[0].data.target;
                            const port = res.answers[0].data.part;
                            if (gw_ip.hostname.indexOf(',') > -1) {
                                gw_ip.hostname = gw_ip.substr(0, socks_ip.indexOf(','));
                            }
                            resolve({
                                socks5_address: gw_ip,
                                socks5_port: port
                            })
                        } else {
                            resolve();
                        }
                    }
                }
            };
            mdns.on('response', res_handler);
            mdns.on('ready', () => {
                mdns.query({
                    questions: [question]
                });
            });
        });
    };
};

module.exports = client;