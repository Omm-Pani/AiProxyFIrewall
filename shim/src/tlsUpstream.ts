import tls, { ConnectionOptions, TLSSocket } from 'tls';
import fs from 'fs';
import { logger } from './logger.js';

export type UpstreamOptions = {
  host: string;
  port: number;
  servername?: string;
  p12Path: string;
  p12Pass: string;
  caPath: string;
  connectTimeoutMs: number;
};

export function connectUpstream(opts: UpstreamOptions): Promise<TLSSocket> {
  return new Promise((resolve, reject) => {
    const pfx = fs.readFileSync(opts.p12Path);
    const ca  = fs.readFileSync(opts.caPath);

    const to: NodeJS.Timeout = setTimeout(() => {
      sock.destroy(new Error('upstream connect timeout'));
    }, opts.connectTimeoutMs);

    const socket = tls.connect({
      host: opts.host,
      port: opts.port,
      pfx, passphrase: opts.p12Pass,
      ca: [ca],
      servername: opts.servername ?? opts.host,
      rejectUnauthorized: true,
      ALPNProtocols: ['http/1.1'] // irrelevant for raw, but keeps TLS stacks happy
    } as ConnectionOptions, () => {
      clearTimeout(to);
      logger.info('upstream mTLS connected', { host: opts.host, port: opts.port });
      resolve(socket);
    });

    const sock = socket;
    sock.setNoDelay(true);
    sock.once('error', (err) => {
      clearTimeout(to);
      reject(err);
    });
  });
}
