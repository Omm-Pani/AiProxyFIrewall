import net, { Socket } from "net";
import { logger } from "./logger.js";
import { connectUpstream } from "./tlsUpstream.js";
import { socks5UpstreamConnect } from "./socks5Client.js";
import { bidirectionalPipe } from "./pipe.js";

function readN(sock: Socket, n: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    let buf = Buffer.alloc(0);
    function tryRead() {
      let chunk: Buffer | null;
      while ((chunk = sock.read()) !== null) {
        buf = Buffer.concat([buf, chunk]);
        if (buf.length >= n) {
          cleanup();
          const out = buf.subarray(0, n);
          const rest = buf.subarray(n);
          if (rest.length) sock.unshift(rest);
          return resolve(out);
        }
      }
    }
    function onReadable() {
      tryRead();
    }
    function onError(e: Error) {
      cleanup();
      reject(e);
    }
    function onEnd() {
      cleanup();
      reject(new Error("socket ended"));
    }
    function cleanup() {
      sock.off("readable", onReadable);
      sock.off("error", onError);
      sock.off("end", onEnd);
    }
    sock.on("readable", onReadable);
    sock.on("error", onError);
    sock.on("end", onEnd);
    tryRead(); // in case data already buffered
  });
}

async function handleClient(
  client: Socket,
  opts: {
    upstreamHost: string;
    upstreamPort: number;
    servername?: string;
    p12Path: string;
    p12Pass: string;
    caPath: string;
    connectTimeoutMs: number;
  }
) {
  const id = client.remoteAddress + ":" + client.remotePort;
  logger.info("client connect", { id });
  client.setTimeout(15000, () => {
    logger.warn("client timeout", { id });
    try {
      client.end();
    } catch {}
  });

  try {
    // Greeting
    const ver = (await readN(client, 1))[0];
    if (ver !== 0x05) throw new Error("not SOCKS5");
    const nMethods = (await readN(client, 1))[0];
    const _methods = await readN(client, nMethods); // ignore methods; we always choose NO-AUTH
    client.write(Buffer.from([0x05, 0x00]));

    // Request
    const head = await readN(client, 4); // VER, CMD, RSV, ATYP
    if (head[0] !== 0x05 || head[2] !== 0x00) throw new Error("bad req");
    if (head[1] !== 0x01) {
      // only CONNECT
      client.write(Buffer.from([0x05, 0x07, 0x00, 0x01, 0, 0, 0, 0, 0, 0])); // Command not supported
      client.end();
      return;
    }
    let host = "";
    let port = 0;
    if (head[3] === 0x01) {
      // IPv4
      const addr = await readN(client, 4);
      host = `${addr[0]}.${addr[1]}.${addr[2]}.${addr[3]}`;
    } else if (head[3] === 0x03) {
      // DOMAIN
      const len = (await readN(client, 1))[0];
      const name = await readN(client, len);
      host = name.toString("utf8");
    } else if (head[3] === 0x04) {
      // IPv6
      const addr = await readN(client, 16);
      // Minimal IPv6 text; for upstream we prefer DOMAIN to resolve server-side
      const parts: string[] = [];
      for (let i = 0; i < 16; i += 2)
        parts.push(((addr[i] << 8) | addr[i + 1]).toString(16));
      host = parts.join(":");
    } else {
      client.write(Buffer.from([0x05, 0x08, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
      client.end();
      return;
    }
    const pbuf = await readN(client, 2);
    port = (pbuf[0] << 8) | pbuf[1];

    // Connect upstream mTLS
    const up = await connectUpstream({
      host: opts.upstreamHost,
      port: opts.upstreamPort,
      servername: opts.servername,
      p12Path: opts.p12Path,
      p12Pass: opts.p12Pass,
      caPath: opts.caPath,
      connectTimeoutMs: opts.connectTimeoutMs,
    });

    // Perform upstream SOCKS5 CONNECT (prefer DOMAIN to force server-side DNS)
    await socks5UpstreamConnect(up, host, port);

    // Reply success locally (use 0.0.0.0:0 for simplicity)
    client.write(Buffer.from([0x05, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
    logger.info("local CONNECT ok", { id, host, port });

    // Pipe both ways
    await bidirectionalPipe(client, up);
    logger.info("client done", { id });
  } catch (e: any) {
    logger.warn("client error", { id, err: e?.message || String(e) });
    try {
      client.write(Buffer.from([0x05, 0x05, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
    } catch {}
    client.end();
  }
}

export function startSocks5Server(
  listenHost: string,
  listenPort: number,
  upstream: {
    host: string;
    port: number;
    servername?: string;
    p12Path: string;
    p12Pass: string;
    caPath: string;
    connectTimeoutMs: number;
  }
) {
  const server = net.createServer((c) =>
    handleClient(c, {
      upstreamHost: upstream.host,
      upstreamPort: upstream.port,
      servername: upstream.servername,
      p12Path: upstream.p12Path,
      p12Pass: upstream.p12Pass,
      caPath: upstream.caPath,
      connectTimeoutMs: upstream.connectTimeoutMs,
    })
  );
  server.on("listening", () => {
    const addr = server.address();
    logger.info("local SOCKS5 listening", { addr });
  });
  server.on("error", (e: any) => {
    logger.error("local server error", { err: e?.message || String(e) });
  });
  server.listen(listenPort, listenHost);
  return server;
}
