// Takes the README screenshots from the fake backend. Usage: node dev-mock/screenshots.mjs [name ...]
// Needs `MOCK=1 npx vite --port 1421` running and Google Chrome installed. Writes to docs/screenshots/.
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const base = "http://localhost:1421/";
const out = new URL("../docs/screenshots/", import.meta.url).pathname;
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** Click the first element of `selector` whose text is `text`. */
const click = (selector, text) => `[...document.querySelectorAll(${JSON.stringify(selector)})].find((e) => e.textContent.trim() === ${JSON.stringify(text)})?.click()`;

const shots = {
  "week-light": { url: "?demo&theme=light", size: [1568, 900], run: [click("button", "Dismiss")] }, // the short-day notice is a real feature, but it hides the grid
  "week-dark": { url: "?demo&theme=dark", size: [1568, 900], run: [click("button", "Dismiss")] },
  "month-light": { url: "?demo&theme=light", size: [1568, 980], run: [click("button", "Month"), "document.querySelectorAll('*').forEach((e) => { if (e.scrollTop) e.scrollTop = 0 })"] },
  "settings-dark": { url: "?demo&theme=dark", run: ['document.querySelector("button[aria-label=\\"More\\"]").click()', '[...document.querySelectorAll("[role=menuitem]")].find((e) => e.textContent.startsWith("Settings")).click()'] },
  "onboarding-light": { url: "?empty&theme=light" },
  "popup-light": { url: "?demo&theme=light#popup", size: [518, 582], scale: 2, run: ['__emit("debug-popup")'], png: true },
};

const port = 9333;
const proc = spawn(chrome, [`--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), "hoot-shots-"))}`, "--headless=new", "--hide-scrollbars", "--no-first-run", "about:blank"], { stdio: "ignore" });
let target;
for (let i = 0; i < 50 && !target; i++) {
  await sleep(200);
  target = await fetch(`http://localhost:${port}/json`).then((r) => r.json()).then((l) => l.find((t) => t.type === "page")).catch(() => null);
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  pending.get(d.id)?.(d);
};
const send = (method, params = {}) => new Promise((res, rej) => {
  pending.set(++id, (d) => (d.error ? rej(new Error(d.error.message)) : res(d.result)));
  ws.send(JSON.stringify({ id, method, params }));
});

const wanted = process.argv.slice(2);
for (const [name, s] of Object.entries(shots)) {
  if (wanted.length && !wanted.includes(name)) continue;
  const [width, height] = s.size ?? [1568, 692];
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: s.scale ?? 1, mobile: false });
  await send("Page.navigate", { url: base + s.url });
  await sleep(1500);
  await send("Runtime.evaluate", { expression: 'document.head.insertAdjacentHTML("beforeend", "<style>.wt-debug { display: none !important }</style>")' });
  for (const js of s.run ?? []) {
    const r = await send("Runtime.evaluate", { expression: js });
    if (r.exceptionDetails) throw new Error(`${name}: ${r.exceptionDetails.exception?.description}`);
    await sleep(600);
  }
  const { data } = await send("Page.captureScreenshot", s.png ? { format: "png" } : { format: "jpeg", quality: 88 });
  writeFileSync(join(out, `${name}.${s.png ? "png" : "jpg"}`), Buffer.from(data, "base64"));
  console.log("wrote", name);
}
ws.close();
proc.kill();
