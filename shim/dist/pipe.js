export function bidirectionalPipe(a, b) {
    // a -> b
    const p1 = oneWay(a, b, 'a->b');
    const p2 = oneWay(b, a, 'b->a');
    p1.catch(() => { });
    p2.catch(() => { });
    return Promise.allSettled([p1, p2]);
}
function oneWay(src, dst, tag) {
    return new Promise((resolve) => {
        src.on('data', (chunk) => {
            const ok = dst.write(chunk);
            if (!ok)
                src.pause();
        });
        dst.on('drain', () => src.resume());
        src.on('end', () => {
            try {
                dst.end();
            }
            catch { }
            resolve();
        });
        src.on('error', () => {
            try {
                dst.end();
            }
            catch { }
            resolve();
        });
        dst.on('error', () => {
            try {
                src.destroy();
            }
            catch { }
            resolve();
        });
    });
}
