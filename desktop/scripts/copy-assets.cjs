const fs = require("fs"),
  path = require("path");
const SRC = path.join(__dirname, "..", "src", "renderer");
const DST = path.join(__dirname, "..", "dist", "renderer");
fs.mkdirSync(DST, { recursive: true });
for (const f of [
  "index.html",
  "renderer.js",
  "preload.js",
  "tray.png",
  "trayTemplate.png",
]) {
  fs.copyFileSync(path.join(SRC, f), path.join(DST, f));
  console.log("copied", f);
}
