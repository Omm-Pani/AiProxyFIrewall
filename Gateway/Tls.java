import java.io.FileInputStream;
import java.net.Socket;
import java.security.KeyStore;
import javax.net.ssl.*;

public final class Tls {
    private Tls() {}

    public static SSLContext serverContext(String keyStorePath, String keyStorePass,
                                           String trustStorePath, String trustStorePass) throws Exception {
        KeyStore ks = KeyStore.getInstance("PKCS12");
        try (FileInputStream fis = new FileInputStream(keyStorePath)) { ks.load(fis, keyStorePass.toCharArray()); }

        KeyStore ts = KeyStore.getInstance("PKCS12");
        try (FileInputStream fis = new FileInputStream(trustStorePath)) { ts.load(fis, trustStorePass.toCharArray()); }

        KeyManagerFactory kmf = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm());
        kmf.init(ks, keyStorePass.toCharArray());

        TrustManagerFactory tmf = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
        tmf.init(ts);

        SSLContext ctx = SSLContext.getInstance("TLSv1.3"); // prefer TLS 1.3
        ctx.init(kmf.getKeyManagers(), tmf.getTrustManagers(), null);
        return ctx;
    }


    public static SSLSocket tlsWrapClient(Socket plain, String peerHost) throws Exception {
        SSLSocketFactory sf = (SSLSocketFactory) SSLSocketFactory.getDefault();
        SSLSocket ssl = (SSLSocket) sf.createSocket(plain, peerHost, plain.getPort(), true);
        SSLParameters p = ssl.getSSLParameters();
        p.setEndpointIdentificationAlgorithm("HTTPS");
        ssl.setSSLParameters(p);
        ssl.startHandshake();
        return ssl;
    }
}
