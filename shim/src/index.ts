import { loadConfig } from './config.js';
import { startSocks5Server } from './socks5Server.js';
import { logger } from './logger.js';
import fs from 'fs';

const cfg = loadConfig();

// Check cert files
for (const p of [cfg.certs.clientP12Path, cfg.certs.serverCaPemPath]) {
  if (!fs.existsSync(p)) {
    logger.error('missing certificate file', { path: p });
    process.exit(1);
  }
}

startSocks5Server(cfg.local.listenHost, cfg.local.listenPort, {
  host: cfg.gateway.host,
  port: cfg.gateway.port,
  servername: cfg.gateway.servername ?? cfg.gateway.host,
  p12Path: cfg.certs.clientP12Path,
  p12Pass: cfg.certs.clientP12Pass,
  caPath: cfg.certs.serverCaPemPath,
  connectTimeoutMs: cfg.timeouts.connectMs
});

logger.info('shim started', { local: cfg.local, gateway: cfg.gateway });
