import java.io.IOException;
import java.net.InetSocketAddress;
import java.util.concurrent.*;
import javax.net.ssl.*;



//java MtlsSocks5Server 0.0.0.0 1080 server-keystore.p12 password server-truststore.p12 password

public class MtlsSocks5Server {
    public static void main(String[] args) throws Exception {
        if (args.length != 6) {
            System.out.println("Usage: java MtlsSocks5Server <bindHost> <port> <serverP12> <serverPass> <trustP12> <trustPass>");
            return;
        }
        String bindHost = args[0];
        int port = Integer.parseInt(args[1]);
        String ks = args[2], ksp = args[3], ts = args[4], tsp = args[5];

        SSLContext ctx = Tls.serverContext(ks, ksp, ts, tsp);
        SSLServerSocketFactory sf = ctx.getServerSocketFactory();
        SSLServerSocket server = (SSLServerSocket) sf.createServerSocket();
        server.bind(new InetSocketAddress(bindHost, port));
        server.setNeedClientAuth(true); // mTLS enforcement
        server.setEnabledProtocols(new String[]{"TLSv1.3","TLSv1.2"});

        // Bounded pool: avoid thread explosion
        ExecutorService pool = new ThreadPoolExecutor(
                32, 256, 60L, TimeUnit.SECONDS,
                new SynchronousQueue<>(),
                r -> { Thread t = new Thread(r, "socks-worker"); t.setDaemon(true); return t; },
                new ThreadPoolExecutor.AbortPolicy());

        System.out.printf("mTLS SOCKS5 server listening on %s:%d (TLSv1.3 preferred)%n", bindHost, port);
        try {
            while (true) {
                SSLSocket client = (SSLSocket) server.accept();
                try {
                    client.setEnabledProtocols(new String[]{"TLSv1.3","TLSv1.2"});
                    client.setSoTimeout(30_000);
                    // Kick handshake early to fail-fast unauthenticated clients
                    client.startHandshake();
                } catch (IOException e) {
                    try { client.close(); } catch (IOException ignore) {}
                    continue;
                }
                // Log peer identity (subject DN) for audit
                SSLSession s = client.getSession();
                java.security.cert.Certificate[] chain = s.getPeerCertificates();
                String subject = (chain != null && chain.length > 0) ?
                        ((java.security.cert.X509Certificate) chain[0]).getSubjectX500Principal().getName() : "unknown";
                System.out.println("Accepted mTLS client: " + subject);
                try {
                    pool.execute(new Socks5Handler(client, pool));
                } catch (RejectedExecutionException rex) {
                    try { client.close(); } catch (IOException ignore) {}
                }
            }
        } finally {
            pool.shutdownNow();
            server.close();
        }
    }
}
