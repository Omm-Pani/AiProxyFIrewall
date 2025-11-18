import os from 'os';
import { exec } from 'child_process';
import { getPacPath } from './pac.js';
export function setSystemProxyOn(pacPath) {
    const platform = os.platform();
    if (platform === 'darwin') {
        const p = pacPath || getPacPath();
        const cmd = `networksetup -setautoproxyurl "Wi-Fi" "file://${p}" && networksetup -setautoproxystate "Wi-Fi" on`;
        return run(cmd);
    }
    else if (platform === 'win32') {
        return Promise.reject(new Error('PAC toggle for Windows is not implemented in this minimal scaffold. Use browser PAC settings for now.'));
    }
    return Promise.reject(new Error('Unsupported platform for system proxy toggle.'));
}
export function setSystemProxyOff() {
    const platform = os.platform();
    if (platform === 'darwin') {
        const cmd = `networksetup -setautoproxystate "Wi-Fi" off && networksetup -setsocksfirewallproxystate "Wi-Fi" off`;
        return run(cmd);
    }
    else if (platform === 'win32') {
        return Promise.reject(new Error('Proxy disable for Windows is not implemented in this minimal scaffold.'));
    }
    return Promise.reject(new Error('Unsupported platform for system proxy toggle.'));
}
function run(cmd) {
    return new Promise((resolve, reject) => {
        exec(cmd, (err, _stdout, _stderr) => {
            if (err)
                return reject(err);
            resolve();
        });
    });
}
