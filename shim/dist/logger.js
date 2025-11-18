let currentLevel = 'info';
const order = { debug: 10, info: 20, warn: 30, error: 40 };
export function setLevel(l) { currentLevel = l; }
function log(level, msg, meta) {
    if (order[level] < order[currentLevel])
        return;
    const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...(meta ?? {}) });
    // Write to stdout; Electron can tail/log to UI later
    console.log(line);
}
export const logger = {
    debug: (m, meta) => log('debug', m, meta),
    info: (m, meta) => log('info', m, meta),
    warn: (m, meta) => log('warn', m, meta),
    error: (m, meta) => log('error', m, meta),
};
