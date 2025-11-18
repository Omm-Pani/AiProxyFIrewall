import fs from "fs";
import path from "path";

const PAC_TEMPLATE = (
  socksAddr: string
) => `function FindProxyForURL(url, host) {
  // Try SOCKS5, then SOCKS (some clients only understand SOCKS), then DIRECT
  return "SOCKS5 ${socksAddr}; SOCKS ${socksAddr}; DIRECT";
}
`;

export async function ensurePac(socksAddr: string) {
  const p = getPacPath();
  await fs.promises.mkdir(path.dirname(p), { recursive: true });
  await fs.promises.writeFile(p, PAC_TEMPLATE(socksAddr), "utf8");
  return p;
}

export function getPacPath() {
  const home = process.env.HOME || process.env.USERPROFILE || ".";
  const dir = path.join(home, ".vpnlikeproxy");
  return path.join(dir, "proxy.pac");
}
