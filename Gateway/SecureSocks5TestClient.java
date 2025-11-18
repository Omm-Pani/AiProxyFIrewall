import java.io.*;
import java.net.InetSocketAddress;
import javax.net.ssl.*;


//java SecureSocks5TestClient localhost 1080 client-keystore.p12 password client-truststore.p12 password

public class SecureSocks5TestClient {
    public static void main(String[] args) throws Exception {
        if (args.length != 6) {
            System.out.println("Usage: java SecureSocks5TestClient <host> <port> <clientP12> <clientPass> <trustP12> <trustPass>");
            return;
        }
        String host = args[0];
        int port = Integer.parseInt(args[1]);
        String ks = args[2], ksp = args[3], ts = args[4], tsp = args[5];

        // Build client SSLContext with mTLS material
        java.security.KeyStore kstore = java.security.KeyStore.getInstance("PKCS12");
        try (FileInputStream fis = new FileInputStream(ks)) { kstore.load(fis, ksp.toCharArray()); }
        KeyManagerFactory kmf = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm());
        kmf.init(kstore, ksp.toCharArray());

        java.security.KeyStore tstore = java.security.KeyStore.getInstance("PKCS12");
        try (FileInputStream fis = new FileInputStream(ts)) { tstore.load(fis, tsp.toCharArray()); }
        TrustManagerFactory tmf = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
        tmf.init(tstore);

        SSLContext ctx = SSLContext.getInstance("TLSv1.3");
        ctx.init(kmf.getKeyManagers(), tmf.getTrustManagers(), null);

        SSLSocketFactory sf = ctx.getSocketFactory();
        try (SSLSocket sock = (SSLSocket) sf.createSocket()) {
            sock.connect(new InetSocketAddress(host, port));
            sock.startHandshake();

            InputStream in = sock.getInputStream();
            OutputStream out = sock.getOutputStream();

            // SOCKS5 greeting: VER=5, NMETHODS=1, METHODS=[0x00]
            out.write(new byte[]{0x05, 0x01, 0x00}); out.flush();
            in.read(); in.read(); // consume server choice (5, 0)

            // SOCKS5 CONNECT to example.com:80
            ByteArrayOutputStream req = new ByteArrayOutputStream();
            req.write(new byte[]{0x05, 0x01, 0x00, 0x03});
            byte[] dom = "example.com".getBytes();
            req.write(dom.length); req.write(dom);
            req.write(0x00); req.write(80);
            out.write(req.toByteArray()); out.flush();

            // Read reply (ignore details)
            byte[] rep = in.readNBytes(10); // minimal read
            if (rep.length < 2 || rep[1] != 0x00) throw new IOException("SOCKS connect failed");

            // Send HTTP request through the tunnel
            out.write("GET / HTTP/1.1\r\nHost: example.com\r\nConnection: close\r\n\r\n".getBytes());
            out.flush();

            // Print first chunk of response
            BufferedReader br = new BufferedReader(new InputStreamReader(in));
            for (int i = 0; i < 20; i++) {
                String line = br.readLine(); if (line == null) break; System.out.println(line);
            }
        }
    }
}
