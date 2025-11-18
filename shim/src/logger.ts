export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

let currentLevel: LogLevel = 'info';
const order: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export function setLevel(l: LogLevel) { currentLevel = l; }
function log(level: LogLevel, msg: string, meta?: Record<string, unknown>) {
  if (order[level] < order[currentLevel]) return;
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...(meta ?? {}) });
  // Write to stdout; Electron can tail/log to UI later
  console.log(line);
}
export const logger = {
  debug: (m: string, meta?: Record<string, unknown>) => log('debug', m, meta),
  info:  (m: string, meta?: Record<string, unknown>) => log('info', m, meta),
  warn:  (m: string, meta?: Record<string, unknown>) => log('warn', m, meta),
  error: (m: string, meta?: Record<string, unknown>) => log('error', m, meta),
};
