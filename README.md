# Zero-Trust mTLS SOCKS5 Proxy & Desktop Client

A highly secure, split-tunneling SOCKS5 proxy ecosystem. This project replaces standard, unencrypted SOCKS5 password authentication with a **Mutual TLS (mTLS)** tunnel, ensuring that only cryptographically verified clients can access the network gateway.

## 🏗 Architecture

The ecosystem consists of three main components:

1. **Java Gateway (`/Gateway`):** The remote server. It enforces mTLS, parses SOCKS5 commands, and streams bidirectional TCP traffic to the target destinations.
2. **Node.js Shim (`/shim`):** The local protocol translator. It accepts plain SOCKS5 traffic from your browser on `127.0.0.1:1080`, evaluates routing rules (split-tunneling), and wraps the traffic in mTLS before forwarding it to the Gateway.
3. **Electron App (`/desktop`):** The local UI. It manages the background Shim process, provides a system tray interface, and automatically configures macOS network routing/PAC scripts.

---

## 🛠 Prerequisites

- **Java 11+** (For the Gateway server)
- **Node.js 18+** (For the Shim and Electron app)
- **OpenSSL & keytool** (For generating mTLS certificates)
- **macOS** (Required for the Electron app's automatic `networksetup` routing. The Shim and Gateway are cross-platform).

---

## 🔐 Step 1: Generating mTLS Certificates (PKI Setup)

Because this is a Zero-Trust architecture, you must act as your own Certificate Authority (CA) to generate the keystores and truststores required by the server and client.

Open your terminal and create a temporary folder for your certificates:

```bash
mkdir certs-build && cd certs-build
```

### 1. Create your root Certificate Authority (CA)

```bash
# Generate CA private key and root certificate (Valid for 10 years)
openssl req -x509 -newkey rsa:4096 -keyout ca.key -out ca.crt -days 3650 -nodes -subj "/CN=My-VPN-CA"
```

### 2. Generate the Server Keystore & Truststore

```bash
# Generate Server Key & CSR
openssl req -newkey rsa:4096 -keyout server.key -out server.csr -nodes -subj "/CN=mtls-socks5.local"

# Sign Server Cert with your CA
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out server.crt -days 3650

# Package Server Key & Cert into a PKCS12 Keystore (Password: "password")
openssl pkcs12 -export -out server-keystore.p12 -inkey server.key -in server.crt -certfile ca.crt -password pass:password

# Create Server Truststore (Tells the server to trust your CA)
keytool -import -file ca.crt -alias myCA -keystore server-truststore.p12 -storepass password -storetype PKCS12 -noprompt
```

### 3. Generate the Client Keystore & Truststore

```bash
# Generate Client Key & CSR
openssl req -newkey rsa:4096 -keyout client.key -out client.csr -nodes -subj "/CN=socks-client"

# Sign Client Cert with your CA
openssl x509 -req -in client.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out client.crt -days 3650

# Package Client Key & Cert into a PKCS12 Keystore (Password: "password")
openssl pkcs12 -export -out client-keystore.p12 -inkey client.key -in client.crt -certfile ca.crt -password pass:password

# Create Client Truststore (Tells the client to trust your CA)
keytool -import -file ca.crt -alias myCA -keystore client-truststore.p12 -storepass password -storetype PKCS12 -noprompt
```

### 4. Distribute the Files

- Move `server-keystore.p12` and `server-truststore.p12` into your `Gateway/` folder.
- Move `client-keystore.p12` and `server.crt` (or `client-truststore.p12`) into your `shim/certs/` folder.

---

## 🚀 Step 2: Running the Java Gateway

The Gateway is designed to run on a remote VPS (e.g., AWS EC2, DigitalOcean).

1. Navigate to the `Gateway` directory:
   ```bash
   cd Gateway
   ```
2. Compile the Java files:
   ```bash
   javac *.java
   ```
3. Run the server. The arguments are: `<bindHost> <port> <serverKeystore> <keystorePass> <truststore> <trustPass>`.
   ```bash
   java MtlsSocks5Server 0.0.0.0 10800 server-keystore.p12 password server-truststore.p12 password
   ```
   _You should see: `mTLS SOCKS5 server listening on 0.0.0.0:10800`_

---

## 🚦 Step 3: Configuring the Node.js Shim

The shim runs locally on your machine, acting as the bridge between your unencrypted local traffic and the remote mTLS gateway.

1. Navigate to the `shim` directory:
   ```bash
   cd shim
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure your environmental variables. You can edit the `config/default.json` or create a `.env` file:
   ```env
   GW_HOST=YOUR_SERVER_IP_HERE
   GW_PORT=10800
   CLIENT_P12=certs/client-keystore.p12
   CLIENT_P12_PASS=password
   SERVER_CA_PEM=certs/server.crt
   LOCAL_PORT=1080
   ```
4. Build and start the shim (Optional, the Electron app can manage this for you):
   ```bash
   npm run build
   npm start
   ```

---

## 🖥 Step 4: Running the Electron Desktop App

The desktop app gives you a system tray icon to easily connect/disconnect without touching the terminal.

1. Navigate to the `desktop` directory:
   ```bash
   cd desktop
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the application in development mode:
   ```bash
   npm run dev
   ```
4. **Usage:**
   - A shield icon will appear in your macOS menu bar.
   - Click **Connect**.
   - The app will spawn the Shim process and automatically run macOS `networksetup` commands to route your system's traffic through `127.0.0.1:1080`.
   - To view real-time connection logs, click **Open Console**.

---

## 🛡 Security Notes if contributing to this Repo

- **Never commit `.p12` or `.key` files to version control.** A strict `.gitignore` is required.
- Ensure your server firewall only leaves your defined gateway port (e.g., `10800`) open.
- The Gateway actively blocks outbound traffic to Port 25 (SMTP) by default via an internal ACL to prevent email spam abuse.

```

```
