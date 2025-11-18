import { logger } from "./logger.js";
function readExactly(sock, n) {
    return new Promise((resolve, reject) => {
        let buf = Buffer.alloc(0);
        function tryRead() {
            let chunk;
            while ((chunk = sock.read()) !== null) {
                buf = Buffer.concat([buf, chunk]);
                if (buf.length >= n) {
                    cleanup();
                    const out = buf.subarray(0, n);
                    const rest = buf.subarray(n);
                    if (rest.length)
                        sock.unshift(rest);
                    return resolve(out);
                }
            }
        }
        function onReadable() {
            tryRead();
        }
        function onError(e) {
            cleanup();
            reject(e);
        }
        function onEnd() {
            cleanup();
            reject(new Error("upstream ended"));
        }
        function cleanup() {
            sock.off("readable", onReadable);
            sock.off("error", onError);
            sock.off("end", onEnd);
        }
        sock.on("readable", onReadable);
        sock.on("error", onError);
        sock.on("end", onEnd);
        tryRead();
    });
}
export async function socks5UpstreamConnect(up, host, port) {
    const TMO = setTimeout(() => {
        try {
            up.destroy(new Error("upstream socks handshake timeout"));
        }
        catch { }
    }, 8000);
    try {
        // Greeting
        up.write(Buffer.from([0x05, 0x01, 0x00])); // NO-AUTH
        const greet = await readExactly(up, 2);
        logger.debug?.("upstream greet reply", { ver: greet[0], method: greet[1] });
        if (greet[0] !== 0x05 || greet[1] !== 0x00) {
            throw new Error(`upstream refused method, ver=${greet[0]} method=${greet[1]}`);
        }
        // CONNECT request (prefer DOMAIN so proxy resolves DNS)
        const isIPv4 = /^\d+\.\d+\.\d+\.\d+$/.test(host);
        const isIPv6 = host.includes(":");
        const req = [Buffer.from([0x05, 0x01, 0x00])];
        if (isIPv4) {
            const parts = host.split(".").map(Number);
            req.push(Buffer.from([0x01, parts[0], parts[1], parts[2], parts[3]]));
        }
        else if (isIPv6) {
            throw new Error("IPv6 literal not supported in upstream client (use domain)");
        }
        else {
            const name = Buffer.from(host, "utf8");
            if (name.length > 255)
                throw new Error("hostname too long");
            req.push(Buffer.from([0x03, name.length]));
            req.push(name);
        }
        req.push(Buffer.from([(port >> 8) & 0xff, port & 0xff]));
        up.write(Buffer.concat(req));
        // Reply head
        const head = await readExactly(up, 4);
        const rep = head[1];
        logger.debug?.("upstream reply head", {
            ver: head[0],
            rep,
            rsv: head[2],
            atyp: head[3],
        });
        if (head[0] !== 0x05 || head[2] !== 0x00)
            throw new Error("bad upstream reply header");
        if (rep !== 0x00)
            throw new Error(`upstream CONNECT failed, REP=${rep}`);
        let toRead = 0;
        if (head[3] === 0x01)
            toRead = 4;
        else if (head[3] === 0x03) {
            const l = (await readExactly(up, 1))[0];
            toRead = l;
        }
        else if (head[3] === 0x04)
            toRead = 16;
        if (toRead)
            await readExactly(up, toRead);
        await readExactly(up, 2);
        logger.info("upstream CONNECT ok", { host, port });
    }
    finally {
        clearTimeout(TMO);
    }
}
