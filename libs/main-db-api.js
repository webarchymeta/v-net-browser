'use strict';

const
    path = require('path'),
    fs = require('fs'),
    sqlite = require(__dirname + '/../libs/sqlitejs');

const dbfile = 'AppMainDB.db';

const sqliteApi = function(opts) {
    const self = this;
    const homedir = opts.home[opts.home.length - 1] === '/' ? opts.home.substr(0, opts.home.length - 1) : opts.home;
    const relpath = opts.path;
    const dbfolder = path.join(homedir, opts.path);
    const schemaPath = opts.schemaPath || path.join(__dirname, '../schema/main.sql');

    let db = undefined;

    self.isOpen = false;

    const createDb = (db) => {
        return new Promise((resolve, reject) => {
            fs.readFile(schemaPath, 'utf8', (err, sql) => {
                if (err)
                    return reject(err);
                let sqls = sql.split(';').map((cmd) => cmd.trim()).filter((cmd) => !!cmd);
                const exec = (i) => {
                    let cmd = sqls[i];
                    try {
                        const r = db.exec(cmd);
                        if (i < sqls.length - 1) {
                            exec(i + 1);
                        } else {
                            self.isOpen = true;
                            resolve(db);
                        }
                    } catch (err) {
                        reject(err);
                    };
                };
                exec(0)
            });
        });
    };

    self.open = () => {
        return new Promise((resolve, reject) => {
            if (self.isOpen) {
                return db;
            }
            const dbpath = path.join(dbfolder, dbfile);
            const open = (isNew) => {
                let dbbuffer = isNew ? undefined : fs.readFileSync(dbpath);
                db = isNew ? new sqlite.Database() : new sqlite.Database(dbbuffer);
                if (isNew) {
                    createDb(db).then(() => {
                        self.isOpen = true;
                        resolve(db);
                    }).catch((err) => {
                        reject(err);
                    });
                } else {
                    self.isOpen = true;
                    resolve(db);
                }
            };
            if (fs.existsSync(dbfolder)) {
                open(!fs.existsSync(dbpath));
            } else {
                let currPath = homedir + '/';
                const dirnodes = relpath.split('/');
                for (let i = 0; i < dirnodes.length; i++) {
                    if (!dirnodes[i])
                        break;
                    currPath += dirnodes[i] + '/';
                    if (!fs.existsSync(currPath)) {
                        fs.mkdirSync(currPath, 0o700);
                    }
                }
                open(true);
            }
        });
    };

    self.save = () => {
        return new Promise((resolve, reject) => {
            const dbpath = path.join(dbfolder, dbfile);
            const dbbuffer = Buffer.from(db.export());
            fs.writeFile(dbpath, dbbuffer, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    };

    self.close = () => {
        return self.save().then(() => {
            db.close();
        });
    };

    const wrapValue = (val) => {
        if (typeof val === 'undefined' || val === undefined || val === null || typeof val !== 'string' && typeof val !== 'boolean')
            return val !== null && val !== undefined ? val : 'NULL';
        if (typeof val === 'boolean') {
            return val ? '1' : '0'
        } else if (val.startsWith("'") && val.endsWith("'")) {
            let str = val.substr(1);
            str = str.substr(0, str.length - 1);
            return "'" + str.replace(/'/g, '\\\'') + "'";
        } else if (val.startsWith('"') && val.endsWith('"')) {
            let str = val.substr(1);
            str = str.substr(0, str.length - 1);
            return "'" + str.replace(/'/g, '\\\'') + "'";
        } else {
            return "'" + val.replace(/'/g, '\\\'') + "'";
        }
    };

    const add = (item) => {
        return new Promise((resolve, reject) => {
            let sql = 'INSERT INTO "' + item.table + '" (';
            let first = true;
            for (let key in item.rec) {
                if (item.rec[key]) {
                    sql += first ? '' : ', ';
                    sql += '"' + key + '"';
                    first = false;
                }
            }
            sql += ') VALUES (';
            first = true;
            for (let key in item.rec) {
                if (item.rec[key]) {
                    sql += first ? '' : ', ';
                    sql += wrapValue(item.rec[key]);
                    first = false;
                }
            }
            sql += ');';
            try {
                const res = db.exec(sql);
                resolve(res);
            } catch (err) {
                reject(err);
            }
        });
    };

    const update = (item) => {
        return new Promise((resolve, reject) => {
            let pred = '';
            let keys = [];
            if (Array.isArray(item.iids)) {
                for (let i = 0; i < item.iids.length; i++) {
                    for (let key in item.iids[i]) {
                        pred += pred ? ' AND ' : '';
                        pred += '"' + key + '"' + (item.iids[i][key] === null ? ' IS NULL' : '=' + wrapValue(item.iids[i][key]));
                        keys.push(key);
                    }
                }
            } else {
                for (let key in item.iids) {
                    pred += pred ? ' AND ' : '';
                    pred += '"' + key + '"' + (item.iids[key] === null ? ' IS NULL' : '=' + wrapValue(item.iids[key]));
                    keys.push(key);
                }
            }
            let sql = 'UPDATE "' + item.table + '" Set ';
            let first = true;
            for (let key in item.rec) {
                if (keys.indexOf(key) === -1) {
                    let val = item.rec[key];
                    if (val !== undefined) {
                        sql += first ? '' : ', ';
                        sql += '"' + key + '" = ' + (val !== '@NULLVAL' && val !== null ? wrapValue(val) : 'NULL');
                        first = false;
                    }
                }
            }
            sql += ' WHERE ' + pred;
            try {
                db.exec(sql);
                resolve();
            } catch (err) {
                reject(err);
            }
        });
    };

    self.add_or_update = (item) => {
        let pred = '';
        if (Array.isArray(item.iids)) {
            for (let i = 0; i < item.iids.length; i++) {
                for (let key in item.iids[i]) {
                    pred += pred ? ' AND ' : '';
                    pred += '"' + key + '"' + (item.iids[i][key] === null ? ' IS NULL' : '=' + wrapValue(item.iids[i][key]));
                }
            }
        } else {
            for (let key in item.iids) {
                pred += pred ? ' AND ' : '';
                pred += '"' + key + '"' + (item.iids[key] === null ? ' IS NULL' : '=' + wrapValue(item.iids[key]));
            }
        }
        let query = {
            table: item.table,
            predicate: pred
        };
        return self.find(query).then((rec) => {
            if (!rec) {
                return add(item);
            } else {
                return update(item).then(() => rec);
            }
        });
    };

    self.remove = (item) => {
        return new Promise((resolve, reject) => {
            let pred = '';
            for (let key in item.iids) {
                pred += pred ? ' AND ' : '';
                pred += '"' + key + '" = ' + wrapValue(item.iids[key]);
            }
            let sql = 'DELETE FROM "' + item.table + '"';
            sql += ' WHERE ' + pred;
            try {
                const res = db.exec(sql);
                resolve(res);
            } catch (err) {
                reject(err);
            }
        });
    };

    self.run = (sql) => {
        return db.run(sql);
    };

    //simple query, one table, no join
    self.find = (query) => {
        return new Promise((resolve, reject) => {
            if (!self.isOpen) {
                reject(new Error('database not open'));
            }
            if (typeof query === 'string') {
                try {
                    const res = db.exec(sql);
                    const rows = res[0].values.map((vrow) => {
                        const row = {};
                        res[0].columns.forEach((c, i) => {
                            row[c] = vrow[i];
                        });
                        return row;
                    });
                    resolve(rows.length > 0 ? rows[0] : undefined);
                } catch (err) {
                    reject(err);
                }
            } else {
                let sql = 'SELECT ';
                if (!query.props) {
                    sql += '*'
                } else if (typeof query.props === 'object') {
                    let plst = '';
                    if (Array === query.props.constructor) {
                        for (let i = 0; i < query.props.length; i++) {
                            plst += i == 0 ? '' : ', ';
                            plst += '"' + query.props[i] + '"';
                        }
                    } else {
                        for (let key in query.props) {
                            plst += plst == '' ? '' : ', ';
                            let val = query.props[key];
                            if (typeof val == 'string') {
                                plst += '"' + val + '" AS "' + key + '"';
                            } else {
                                if (val.func) {
                                    plst += val.func + '("' + val.field + '") AS "' + key + '"';
                                }
                            }
                        }
                    }
                    sql += plst;
                } else if (typeof query.props === 'string') {
                    if (query.props.toLowerCase() === 'count') {
                        sql += 'COUNT(*) AS total';
                    }
                }
                if (sql.length > 'select '.length) {
                    sql += ' FROM "' + query.table + '"' + (query.predicate ? ' WHERE ' + query.predicate : '');
                    if (query.group_by) {
                        let plst = '';
                        for (let i = 0; i < query.group_by.props.length; i++) {
                            plst += i == 0 ? '' : ', ';
                            plst += '"' + query.group_by.props[i] + '"';
                        }
                        sql += ' GROUP BY ' + plst;
                    }
                    sql += ';';
                    try {
                        const res = db.exec(sql);
                        const rows = res.length > 0 ? res[0].values.map((vrow) => {
                            const row = {};
                            res[0].columns.forEach((c, i) => {
                                row[c] = vrow[i];
                            });
                            return row;
                        }) : [];
                        resolve(rows.length > 0 ? rows[0] : undefined);
                    } catch (err) {
                        reject(err);
                    }
                } else {
                    reject(new Error('incomplete sql statement'));
                }
            }
        });
    };

    //simple query, one table, no join
    self.all = (query) => {
        return new Promise((resolve, reject) => {
            if (!self.isOpen) {
                reject(new Error('database not open'));
            }
            if (typeof query === 'string') {
                try {
                    const res = db.exec(sql);
                    resolve(res[0].values.map((vrow) => {
                        const row = {};
                        res[0].columns.forEach((c, i) => {
                            row[c] = vrow[i];
                        });
                        return row;
                    }));
                } catch (err) {
                    reject(err);
                }
            } else {
                let sql = 'SELECT ';
                if (!query || !query.props) {
                    sql += '*'
                } else if (typeof query.props === 'object') {
                    let plst = '';
                    if (Array.isArray(query.props)) {
                        for (let i = 0; i < query.props.length; i++) {
                            plst += i == 0 ? '' : ', ';
                            plst += query.props[i];
                        }
                    } else {
                        for (let key in query.props) {
                            plst += plst == '' ? '' : ', ';
                            let val = query.props[key];
                            if (typeof val == 'string') {
                                plst += '"' + val + '" AS "' + key + '"';
                            } else {
                                if (val.func) {
                                    plst += val.func + '("' + val.field + '") AS "' + key + '"';
                                }
                            }
                        }
                    }
                    sql += plst;
                } else if (typeof query.props === 'string') {
                    if (query.props.toLowerCase() === 'count') {
                        sql += 'COUNT(*) AS total';
                    }
                }
                if (sql.length > 'select '.length) {
                    sql += ' FROM "' + query.table + '"' + (query.predicate ? ' WHERE ' + query.predicate : '');
                    if (query.group_by) {
                        let plst = '';
                        for (let i = 0; i < query.group_by.props.length; i++) {
                            plst += i == 0 ? '' : ', ';
                            plst += '"' + query.group_by.props[i] + '"';
                        }
                        sql += ' GROUP BY ' + plst;
                    }
                    sql += ';';
                    try {
                        const res = db.exec(sql);
                        resolve(res.length > 0 ? res[0].values.map((vrow) => {
                            const row = {};
                            res[0].columns.forEach((c, i) => {
                                row[c] = vrow[i];
                            });
                            return row;
                        }) : []);
                    } catch (err) {
                        reject(err);
                    }
                } else {
                    reject(new Error('incomplete sql statement'));
                }
            }
        });
    };
};

module.exports = sqliteApi;