# Electron Tray + PAC (Path A)

This app starts/stops your **Node SOCKS5 shim** and toggles **system PAC** (macOS implemented).

## Prereqs
- Node 18+
- Your shim built (`npm run build` in `shim/`), so `shim/dist/index.js` exists
- macOS for PAC toggling (Windows PAC toggle in this minimal scaffold is not implemented yet)

## Configure
By default, this looks for the shim in `../shim` relative to this app.

- To override paths:
  - `SHIM_DIR=/absolute/path/to/shim`
  - `SHIM_START_CMD=node`
  - `SHIM_ARGS="dist/index.js"`
  - `LOCAL_SOCKS=127.0.0.1:1080`

## Run (dev)
```bash
cd desktop
npm i
npm run build
npm start
```
- Click the tray icon → **Connect** to start the shim
- Click **Enable System PAC** (macOS) to route traffic via `proxy.pac`

## Build installers
```bash
npm run dist
```

## Notes
- The renderer buttons currently instruct you to use the tray menu (kept minimal on purpose).
- PAC template routes **everything via SOCKS**. Edit `src/proxy/pac.ts` to customize (domains, CIDRs, etc.).
- On Windows, use browser-level PAC config for now, or extend `systemProxy.ts` to set user WinINET PAC in registry.
