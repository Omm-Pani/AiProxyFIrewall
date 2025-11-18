import { Socket } from 'net';
import { TLSSocket } from 'tls';
import { logger } from './logger.js';

type AnySock = Socket | TLSSocket;

export function bidirectionalPipe(a: AnySock, b: AnySock) {
  // a -> b
  const p1 = oneWay(a, b, 'a->b');
  const p2 = oneWay(b, a, 'b->a');
  p1.catch(()=>{}); p2.catch(()=>{});
  return Promise.allSettled([p1, p2]);
}

function oneWay(src: AnySock, dst: AnySock, tag: string): Promise<void> {
  return new Promise((resolve) => {
    src.on('data', (chunk) => {
      const ok = dst.write(chunk);
      if (!ok) src.pause();
    });
    dst.on('drain', () => src.resume());
    src.on('end', () => {
      try { dst.end(); } catch {}
      resolve();
    });
    src.on('error', () => {
      try { dst.end(); } catch {}
      resolve();
    });
    dst.on('error', () => {
      try { src.destroy(); } catch {}
      resolve();
    });
  });
}
