import os from "os";
import { exec } from "child_process";
import { getPacPath } from "./pac.js";

function pickServiceCmd(): string {
  // Use explicit env if set
  if (process.env.SERVICE_NAME) return process.env.SERVICE_NAME;

  // Try to auto-pick a Wi-Fi-like service name
  // We'll call `networksetup -listallnetworkservices` and choose the first containing 'Wi-Fi'
  return "AUTO_WIFI";
}

function run(cmd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    exec(cmd, (err) => (err ? reject(err) : resolve()));
  });
}

async function resolveServiceName(): Promise<string> {
  const wanted = pickServiceCmd();
  if (wanted !== "AUTO_WIFI") return wanted;

  return await new Promise((resolve, reject) => {
    exec("networksetup -listallnetworkservices", (err, stdout) => {
      if (err) return reject(err);
      const lines = stdout
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      // Lines starting with "*" are disabled; ignore them
      const active = lines.filter((s) => !s.startsWith("*"));
      // Prefer ones containing Wi-Fi
      const wifi = active.find((s) => /wi-?fi/i.test(s));
      if (wifi) return resolve(wifi);
      // fallback to first active
      if (active.length) return resolve(active[0]);
      reject(new Error("No active network service found"));
    });
  });
}

export async function setSystemProxyOn(pacPath?: string): Promise<void> {
  const platform = os.platform();
  if (platform === "darwin") {
    const p = pacPath || getPacPath();
    const svc = await resolveServiceName();
    // set PAC URL + turn it on
    await run(`networksetup -setautoproxyurl "${svc}" "file://${p}"`);
    await run(`networksetup -setautoproxystate "${svc}" on`);
    return;
  } else if (platform === "win32") {
    throw new Error(
      "PAC toggle for Windows is not implemented in this scaffold."
    );
  }
  throw new Error("Unsupported platform for system proxy toggle.");
}

export async function setSystemProxyOff(): Promise<void> {
  const platform = os.platform();
  if (platform === "darwin") {
    const svc = await resolveServiceName();
    await run(`networksetup -setautoproxystate "${svc}" off`);
    await run(`networksetup -setsocksfirewallproxystate "${svc}" off`);
    return;
  } else if (platform === "win32") {
    throw new Error(
      "Proxy disable for Windows is not implemented in this scaffold."
    );
  }
  throw new Error("Unsupported platform for system proxy toggle.");
}
export async function setManualSocksOn(
  host: string,
  port: number
): Promise<void> {
  const platform = os.platform();
  if (platform === "darwin") {
    const svc = await resolveServiceName();
    // This command sets the IP/Port AND turns the state to "On" automatically
    // Command: networksetup -setsocksfirewallproxy "Wi-Fi" 127.0.0.1 1080
    await run(`networksetup -setsocksfirewallproxy "${svc}" ${host} ${port}`);
    // Ensure it is definitely on (redundancy is good here)
    await run(`networksetup -setsocksfirewallproxystate "${svc}" on`);
    return;
  } else if (platform === "win32") {
    // Windows implementation would go here (Registry/WinINET)
    console.warn("Windows manual proxy not implemented yet");
    return;
  }
  throw new Error("Unsupported platform for system proxy toggle.");
}
