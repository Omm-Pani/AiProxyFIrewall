import java.io.*;
import java.net.*;
import java.util.concurrent.ExecutorService;
import javax.net.ssl.SSLSocket;

public class Socks5Handler implements Runnable {
    private static final int SOCKS_VERSION = 0x05;
    private static final int METHOD_NO_AUTH = 0x00; // we rely on mTLS for auth

    private final SSLSocket client;
    private final ExecutorService pool;

    public Socks5Handler(SSLSocket client, ExecutorService pool) {
        this.client = client; this.pool = pool;
    }

    @Override public void run() {
        try {
            client.setSoTimeout(30_000);
            InputStream in = client.getInputStream();
            OutputStream out = client.getOutputStream();

            // 1) Greeting: VER, NMETHODS, METHODS...
            int ver = in.read();
            if (ver != SOCKS_VERSION) throw new IOException("Not SOCKS5");
            int nMethods = in.read();
            if (nMethods < 0) throw new EOFException();
            byte[] methods = in.readNBytes(nMethods);
            // Always respond NO-AUTH (0x00); TLS already handled identity
            out.write(new byte[]{ (byte)SOCKS_VERSION, (byte)METHOD_NO_AUTH });
            out.flush();

            // 2) Request: VER CMD RSV ATYP DST.ADDR DST.PORT
            DataInputStream din = new DataInputStream(in);
            int reqVer = din.readUnsignedByte();
            int cmd = din.readUnsignedByte();
            din.readUnsignedByte(); // RSV
            int atyp = din.readUnsignedByte();

            String host;
            if (atyp == 0x01) { // IPv4
                byte[] addr = din.readNBytes(4);
                host = InetAddress.getByAddress(addr).getHostAddress();
            } else if (atyp == 0x03) { // DOMAINNAME
                int len = din.readUnsignedByte();
                byte[] domain = din.readNBytes(len);
                host = new String(domain);
            } else if (atyp == 0x04) { // IPv6
                byte[] addr = din.readNBytes(16);
                host = InetAddress.getByAddress(addr).getHostAddress();
            } else {
                sendReply(out, 0x08, new InetSocketAddress(0)); // address type not supported
                return;
            }
            int port = din.readUnsignedShort();

            if (cmd != 0x01) { // only CONNECT
                sendReply(out, 0x07, new InetSocketAddress(0)); // command not supported
                return;
            }

            // === ACL hook (optional) ===
            if (!Acl.allow(client, host, port)) {
                sendReply(out, 0x02, new InetSocketAddress(0)); // connection not allowed
                return;
            }

            // 3) Connect to target
            Socket target = new Socket();
            try {
                target.connect(new InetSocketAddress(host, port), 15_000);
                target.setSoTimeout(60_000);
            } catch (IOException e) {
                sendReply(out, 0x05, new InetSocketAddress(0)); // connection refused
                target.close();
                return;
            }

            // 4) Send success reply with bound address
            InetSocketAddress local = (InetSocketAddress) target.getLocalSocketAddress();
            sendReply(out, 0x00, local);

            // 5) Pipe data both ways
            Thread c2t = new Thread(new Pipe(in, target.getOutputStream(), target, "c2t"));
            Thread t2c = new Thread(new Pipe(target.getInputStream(), out, client, "t2c"));
            c2t.start(); t2c.start();
            c2t.join(); t2c.join();
            target.close();
        } catch (Exception e) {
            // log minimal info; avoid dumping PII
            System.err.println("SOCKS session error: " + e.getMessage());
        } finally {
            try { client.close(); } catch (IOException ignore) {}
        }
    }

    private void sendReply(OutputStream out, int rep, InetSocketAddress bind) throws IOException {
        ByteArrayOutputStream buf = new ByteArrayOutputStream();
        buf.write(SOCKS_VERSION);
        buf.write(rep);
        buf.write(0x00); // RSV

        InetAddress addr = bind.getAddress();
        if (addr == null || addr instanceof Inet4Address) {
            buf.write(0x01);
            byte[] ip = (addr == null ? new byte[]{0,0,0,0} : addr.getAddress());
            buf.write(ip);
        } else if (addr instanceof Inet6Address) {
            buf.write(0x04);
            buf.write(addr.getAddress());
        } else {
            buf.write(0x01); buf.write(new byte[]{0,0,0,0});
        }
        int port = bind.getPort();
        buf.write((port >> 8) & 0xFF);
        buf.write(port & 0xFF);
        out.write(buf.toByteArray());
        out.flush();
    }

    // Minimal ACL example
    static class Acl {
        static boolean allow(SSLSocket client, String host, int port) {
            // Example: block SMTP, allow others; insert CIDR/domain allowlists as needed.
            if (port == 25) return false;
            return true;
        }
    }
}
