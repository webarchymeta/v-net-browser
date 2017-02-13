'use strict';

const job = function(_db, cmd) {
    const self = this;
    const db = _db;
    self.pending = undefined;
    self.current = cmd;
    self.enqueue = (_cmd) => {
        self.current = _cmd;
        if (!self.pending) {
            self.pending = setTimeout(() => {
                self.flush(true)
            }, 2000);
        }
    };
    self.flush = (auto) => {
        if (!auto) {
            clearTimeout(self.pending);
        }
        self.pending = undefined;
        if (self.current) {
            return db.add_or_update(self.current).then(() => {
                self.current = undefined;
            });
        } else {
            return Promise.resolve();
        }
    };
};

const updator = function(_db) {
    const self = this;
    const db = _db;
    const pendings = {};
    const deferredExc = (cmd) => {
        let pending = pendings[cmd.table];
        if (!pending) {
            pending = new job(db, cmd);
            pendings[cmd.table] = pending;
        }
        pending.enqueue(cmd);
    };

    self.flush = () => {
        return Promise.all(Object.keys(pendings).map(key => {
            return pendings[key].flush();
        }));
    };
    self.updateWindowState = (winId, wstate) => {
        const cmd = {
            table: 'window-states',
            iids: [{
                'window_id': winId
            }],
            rec: {
                window_id: winId,
                loc_x: wstate.bounds.x,
                loc_y: wstate.bounds.y,
                width: wstate.bounds.width,
                height: wstate.bounds.height
            }
        };
        deferredExc(cmd);
    };
};

module.exports = updator;