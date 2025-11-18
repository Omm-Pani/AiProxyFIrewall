# Phase 2 — Node SOCKS5 Shim (mTLS upstream)

This is the local entry point apps will use: it listens on `127.0.0.1:<port>` and forwards each SOCKS5 `CONNECT` over an **mTLS** connection to your AWS mTLS SOCKS5 gateway, then pipes bytes both ways.

## Prereqs
- Node.js ≥ 18
- Place your certs at:
  - `./certs/client.p12` (client identity)
  - `./certs/server.crt` (gateway CA/server cert)

## Configure
Edit `config/default.json`:
```json
{
  "local": { "listenHost": "127.0.0.1", "listenPort": 1080 },
  "gateway": { "host": "your-gateway.example.com", "port": 8443, "servername": "your-gateway.example.com" },
  "certs": {
    "clientP12Path": "./certs/client.p12",
    "clientP12Pass": "changeit",
    "serverCaPemPath": "./certs/server.crt"
  }
}
```

## Install & run (dev)
```bash
cd shim
npm i
npm run dev
# In a new terminal, test via curl:
curl --socks5-hostname 127.0.0.1:1080 https://example.com -v
```

## Build & run (prod)
```bash
npm run build
npm start
```

**Notes**
- We use SOCKS5 `NO AUTH` locally; **mTLS** provides auth/encryption to the gateway.
- Upstream prefers **DOMAIN** names to ensure **server-side DNS**.
