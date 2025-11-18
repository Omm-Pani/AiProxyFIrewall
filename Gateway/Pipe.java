import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.Socket;

public final class Pipe implements Runnable {
    private final InputStream in;
    private final OutputStream out;
    private final Socket outSocket; // for half-close
    private final String name;

    public Pipe(InputStream in, OutputStream out, Socket outSocket, String name) {
        this.in = in; this.out = out; this.outSocket = outSocket; this.name = name;
    }

    @Override public void run() {
        byte[] buf = new byte[16 * 1024];
        try {
            int n;
            while ((n = in.read(buf)) != -1) {
                out.write(buf, 0, n);
                out.flush();
            }
        } catch (IOException ignored) {
        } finally {
            try { out.flush(); } catch (IOException ignore) {}
            try { outSocket.shutdownOutput(); } catch (IOException ignore) {}
        }
    }
}
