import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { setLevel } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type Cfg = {
  local: { listenHost: string; listenPort: number; };
  gateway: { host: string; port: number; servername?: string; };
  certs: { clientP12Path: string; clientP12Pass: string; serverCaPemPath: string; };
  timeouts: { connectMs: number; idleReadMs: number; idleWriteMs: number; };
  logging: { level: 'debug'|'info'|'warn'|'error'; };
};

function loadJson(p: string) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

export function loadConfig(): Cfg {
  const cfgPath = path.resolve(__dirname, '..', 'config', 'default.json');
  const cfg = loadJson(cfgPath) as Cfg;

  // Allow ENV overrides for secrets/CI
  if (process.env.GW_HOST) cfg.gateway.host = process.env.GW_HOST;
  if (process.env.GW_PORT) cfg.gateway.port = Number(process.env.GW_PORT);
  if (process.env.GW_SNI) cfg.gateway.servername = process.env.GW_SNI;
  if (process.env.CLIENT_P12) cfg.certs.clientP12Path = process.env.CLIENT_P12;
  if (process.env.CLIENT_P12_PASS) cfg.certs.clientP12Pass = process.env.CLIENT_P12_PASS;
  if (process.env.SERVER_CA_PEM) cfg.certs.serverCaPemPath = process.env.SERVER_CA_PEM;
  if (process.env.LOCAL_PORT) cfg.local.listenPort = Number(process.env.LOCAL_PORT);
  if (process.env.LOG_LEVEL) cfg.logging.level = process.env.LOG_LEVEL as any;

  setLevel(cfg.logging.level);
  return cfg;
}
