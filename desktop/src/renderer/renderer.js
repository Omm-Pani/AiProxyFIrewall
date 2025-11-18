const logs = document.getElementById("logs");
const shim = document.getElementById("shim");
const proxy = document.getElementById("proxy");

window.bridge.onLog((line) => {
  const div = document.createElement("div");
  div.textContent = line;
  logs.appendChild(div);
  logs.scrollTop = logs.scrollHeight;
});
window.bridge.onStatus((st) => {
  if (st.type === "shim") shim.textContent = st.value;
  if (st.type === "proxy") proxy.textContent = st.value;
});

window.bridgeStart = async () => {
  await window.bridge.startShim();
};
window.bridgeStop = async () => {
  await window.bridge.stopShim();
};
window.bridgeEnablePAC = async () => {
  const p = await window.bridge.proxyOn();
  const div = document.createElement("div");
  div.textContent = "PAC enabled at: " + p;
  logs.appendChild(div);
  proxy.textContent = "on";
};
window.bridgeDisableProxy = async () => {
  await window.bridge.proxyOff();
  const div = document.createElement("div");
  div.textContent = "PAC disabled";
  logs.appendChild(div);
  proxy.textContent = "off";
};
