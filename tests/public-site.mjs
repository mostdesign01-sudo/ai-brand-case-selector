import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const api = require(path.join(root, "assets/app.js"));

const failures = [];
function check(cond, message) {
  if (!cond) {
    failures.push(message);
    console.error("FAIL", message);
  } else {
    console.log("ok", message);
  }
}

function chars(...codes) {
  return String.fromCodePoint(...codes);
}

const PHRASES = [
  chars(0x5f97, 0x7269),
  ["De", "wu"].join(""),
  ["DE", "WU"].join(""),
  ["NO", "NO"].join(""),
  ["NI", "NI"].join(""),
  ["Ha", "o"].join(""),
  ["T", "7"].join(""),
  ["20", "27"].join(""),
  chars(0x5019, 0x9009, 0x7814, 0x7a76, 0x65b9, 0x5411),
  chars(0x54c1, 0x724c, 0x56e2, 0x961f),
  chars(0x5e74, 0x5ea6, 0x95ee, 0x9898),
  chars(0x63d0, 0x6848),
  ["/Us", "ers/"].join(""),
  ["/ho", "me/"].join(""),
  [".pd", "f"].join(""),
  ["sug", "gest"].join("")
];

const SITE_FILES = [
  "index.html",
  "README.md",
  "evidence.json",
  "evidence.csv",
  "assets/app.js",
  "assets/styles.css",
  "assets/favicon.svg",
  ".github/workflows/pages.yml"
];

const data = JSON.parse(fs.readFileSync(path.join(root, "evidence.json"), "utf8"));
const ids = data.cases.map((item) => item.id);

function scanSite() {
  for (const rel of SITE_FILES) {
    const text = fs.readFileSync(path.join(root, rel), "utf8");
    for (const phrase of PHRASES) {
      if (text.includes(phrase)) failures.push(rel + " contains a removed phrase");
    }
  }
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  check(!html.includes('id="directions"') && !html.includes('id="dir-list"'), "proposal section removed from HTML");
  check(!Object.prototype.hasOwnProperty.call(data, "directions"), "proposal block removed from evidence JSON");
  check(data.cases.every((item) => !Object.prototype.hasOwnProperty.call(item, "suggest")), "brand-team advice removed from cases");
  check(data.cases.length === 6, "six cases");
  for (const category of ["ip", "brand", "image"]) {
    check(data.cases.filter((item) => item.category === category).length === 2, "two cases in " + category);
  }
  const recent = data.cases.filter((item) => api.inWindow(item.date_iso, "6m")).map((item) => item.id).sort();
  check(JSON.stringify(recent) === JSON.stringify([
    "brand-unilever-packaging-2026",
    "image-loreal-cisce-2026",
    "ip-tmall-fuli-2026"
  ]), "recent 6 months is Tmall, Unilever, and L'Oreal");
  const csv = fs.readFileSync(path.join(root, "evidence.csv"), "utf8").trim().split(/\r?\n/);
  check(csv.length === 7, "evidence CSV has a header and six rows");
}

function memoryStorage() {
  const bag = new Map();
  return {
    getItem(key) { return bag.has(key) ? bag.get(key) : null; },
    setItem(key, value) { bag.set(key, String(value)); },
    removeItem(key) { bag.delete(key); }
  };
}

function logicTests() {
  const storage = memoryStorage();
  const map = { "ip-tmall-fuli-2026": "入选", "image-loreal-cisce-2026": "候补" };
  check(api.saveMap(storage, map) === true, "localStorage write succeeds");
  const loaded = api.loadMap(storage, ids);
  check(loaded.error === false && loaded.map["ip-tmall-fuli-2026"] === "入选" && loaded.map["image-loreal-cisce-2026"] === "候补", "localStorage read restores statuses");
  check(api.statusOf(loaded.map, "brand-coke-fizzion-2025") === "未处理", "unknown selection stays untreated");

  const visible = data.cases.filter((item) => api.matchCase({
    category: item.category,
    date_iso: item.date_iso,
    status: api.statusOf(loaded.map, item.id),
    hay: [item.title, item.brand].join(" ")
  }, { category: "all", window: "6m", status: "all", query: "" }));
  check(visible.length === 3, "matchCase recent window returns three");

  const tally = { "未处理": 0, "入选": 0, "候补": 0, "暂不考虑": 0 };
  data.cases.forEach((item) => { tally[api.statusOf(loaded.map, item.id)] += 1; });
  check(tally["未处理"] === 4 && tally["入选"] === 1 && tally["候补"] === 1 && tally["暂不考虑"] === 0, "status counts from stored map");

  const exported = api.toExport(data.cases, loaded.map);
  const csv = api.toCsv(exported.selections);
  check(csv.charCodeAt(0) === 0xfeff && csv.includes("天猫") && csv.includes("候补") && csv.includes("https://"), "CSV export carries title, status, and source");
  const imported = api.validateImport(JSON.stringify(exported), ids);
  check(imported.ok && imported.selections.length === 6, "JSON export imports back");
  const rejected = api.validateImport(JSON.stringify({ schema: "other", selections: [] }), ids);
  check(rejected.ok === false, "unknown JSON schema is rejected");
}

function serve(dir) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    let rel = decodeURIComponent(url.pathname);
    if (rel === "/") rel = "/index.html";
    const file = path.normalize(path.join(dir, rel));
    if (!file.startsWith(dir)) {
      res.writeHead(403);
      res.end();
      return;
    }
    fs.readFile(file, (err, body) => {
      if (err) {
        res.writeHead(404);
        res.end("missing");
        return;
      }
      const types = {
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".svg": "image/svg+xml",
        ".jpg": "image/jpeg",
        ".png": "image/png",
        ".csv": "text/csv; charset=utf-8"
      };
      res.writeHead(200, {
        "Content-Type": types[path.extname(file)] || "application/octet-stream",
        "Cache-Control": "no-store"
      });
      res.end(body);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function startChrome(userDir) {
  const proc = spawn("google-chrome", [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--remote-debugging-port=0",
    "--user-data-dir=" + userDir,
    "about:blank"
  ], { stdio: ["ignore", "pipe", "pipe"] });
  let buf = "";
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("chrome did not open devtools")), 20000);
    const onData = (chunk) => {
      buf += chunk.toString();
      const match = buf.match(/DevTools listening on (ws:\/\/127\.0\.0\.1:\d+\/devtools\/browser\/\S+)/);
      if (match) {
        clearTimeout(timer);
        resolve({ proc, browserUrl: match[1] });
      }
    };
    proc.stdout.on("data", onData);
    proc.stderr.on("data", onData);
    proc.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error("chrome exited " + code));
    });
  });
}

class Cdp {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.next = 0;
    this.pending = new Map();
  }
  open() {
    return new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve, { once: true });
      this.ws.addEventListener("error", reject, { once: true });
      this.ws.addEventListener("message", (event) => {
        const message = JSON.parse(event.data);
        if (message.id && this.pending.has(message.id)) {
          const waiter = this.pending.get(message.id);
          this.pending.delete(message.id);
          if (message.error) waiter.reject(new Error(JSON.stringify(message.error)));
          else waiter.resolve(message.result || {});
        }
      });
    });
  }
  send(method, params, sessionId) {
    const id = ++this.next;
    const payload = { id, method, params: params || {} };
    if (sessionId) payload.sessionId = sessionId;
    this.ws.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }
  close() {
    this.ws.close();
  }
}

async function evaluate(cdp, sessionId, expression) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true
  }, sessionId);
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}

async function waitForCases(cdp, sessionId) {
  for (let i = 0; i < 40; i += 1) {
    const ready = await evaluate(cdp, sessionId, "document.querySelectorAll('article.case').length === 6 && document.getElementById('loading').hidden");
    if (ready) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  const error = await evaluate(cdp, sessionId, "document.getElementById('error') ? document.getElementById('error').textContent : ''");
  throw new Error("cases did not render " + error);
}

async function openPage(cdp, sessionId, url, width) {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width,
    height: 800,
    deviceScaleFactor: 2,
    mobile: true
  }, sessionId);
  await cdp.send("Page.navigate", { url }, sessionId);
  await waitForCases(cdp, sessionId);
}

async function shot(cdp, sessionId, file) {
  const image = await cdp.send("Page.captureScreenshot", { format: "png" }, sessionId);
  fs.writeFileSync(file, Buffer.from(image.data, "base64"));
}

async function browserTests(origin) {
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), "selector-chrome-"));
  const chrome = await startChrome(userDir);
  const cdp = new Cdp(chrome.browserUrl);
  try {
    await cdp.open();
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    await cdp.send("Page.enable", {}, sessionId);
    await cdp.send("Runtime.enable", {}, sessionId);
    await cdp.send("DOM.enable", {}, sessionId);

    await openPage(cdp, sessionId, origin + "/", 390);
    const wide = await evaluate(cdp, sessionId, "({overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, width: window.innerWidth, proposal: !!document.getElementById('directions'), resources: performance.getEntriesByType('resource').map((entry) => entry.name)})");
    check(wide.width === 390, "viewport is 390");
    check(wide.overflow <= 1, "no page overflow at 390");
    check(wide.proposal === false, "proposal section is not in the 390 DOM");
    check(wide.resources.every((name) => name.startsWith(origin)), "page only loads same-origin files");
    await evaluate(cdp, sessionId, "document.querySelector('[data-filter-group=\"window\"] button[data-value=\"6m\"]').click()");
    const recent = await evaluate(cdp, sessionId, "Array.from(document.querySelectorAll('article.case')).filter((node) => !node.hidden).map((node) => node.id).sort()");
    check(JSON.stringify(recent) === JSON.stringify([
      "brand-unilever-packaging-2026",
      "image-loreal-cisce-2026",
      "ip-tmall-fuli-2026"
    ]), "390 recent filter shows Tmall, Unilever, and L'Oreal");
    fs.mkdirSync("/opt/cursor/artifacts", { recursive: true });
    await shot(cdp, sessionId, "/opt/cursor/artifacts/selector-390.png");

    await evaluate(cdp, sessionId, "localStorage.clear()");
    await openPage(cdp, sessionId, origin + "/", 360);
    const narrow = await evaluate(cdp, sessionId, "({overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, width: window.innerWidth, counts: Object.fromEntries(Array.from(document.querySelectorAll('[data-count-for]')).map((node) => [node.getAttribute('data-count-for'), node.textContent])), cats: Object.fromEntries(['ip','brand','image'].map((cat) => [cat, document.querySelectorAll('article.case[data-category=\"'+cat+'\"]').length]))})");
    check(narrow.width === 360, "viewport is 360");
    check(narrow.overflow <= 1, "no page overflow at 360");
    check(narrow.counts["未处理"] === "6" && narrow.counts["入选"] === "0", "initial status counts are all untreated");
    check(narrow.cats.ip === 2 && narrow.cats.brand === 2 && narrow.cats.image === 2, "two rendered cards in each category");

    await evaluate(cdp, sessionId, "document.querySelector('#ip-tmall-fuli-2026 button[data-status=\"入选\"]').click(); document.querySelector('#brand-unilever-packaging-2026 button[data-status=\"入选\"]').click(); document.querySelector('#image-loreal-cisce-2026 button[data-status=\"候补\"]').click(); document.querySelector('#ip-coke-holidays-2025 button[data-status=\"暂不考虑\"]').click();");
    const after = await evaluate(cdp, sessionId, "Object.fromEntries(Array.from(document.querySelectorAll('[data-count-for]')).map((node) => [node.getAttribute('data-count-for'), node.textContent]))");
    check(after["入选"] === "2" && after["候补"] === "1" && after["暂不考虑"] === "1" && after["未处理"] === "2", "status counts update after four choices");
    await evaluate(cdp, sessionId, "document.querySelector('[data-filter-group=\"status\"] button[data-value=\"入选\"]').click()");
    const picked = await evaluate(cdp, sessionId, "Array.from(document.querySelectorAll('article.case')).filter((node) => !node.hidden).map((node) => node.id).sort()");
    check(JSON.stringify(picked) === JSON.stringify(["brand-unilever-packaging-2026", "ip-tmall-fuli-2026"]), "status filter shows the two selected cases");

    await openPage(cdp, sessionId, origin + "/", 360);
    const stored = await evaluate(cdp, sessionId, "JSON.parse(localStorage.getItem('ai-brand-case-selection-v1'))");
    const pressed = await evaluate(cdp, sessionId, "document.querySelector('#brand-unilever-packaging-2026 button[aria-pressed=\"true\"]').getAttribute('data-status')");
    check(stored["ip-tmall-fuli-2026"] === "入选" && stored["image-loreal-cisce-2026"] === "候补" && pressed === "入选", "localStorage survives refresh");

    await evaluate(cdp, sessionId, "document.getElementById('export-json').click(); document.getElementById('export-csv').click();");
    const io = await evaluate(cdp, sessionId, "document.getElementById('io-msg').textContent");
    check(io.includes("CSV"), "CSV export control runs in the page");

    const transfer = api.toExport(data.cases, {
      "ip-tmall-fuli-2026": "候补",
      "brand-unilever-packaging-2026": "暂不考虑",
      "image-loreal-cisce-2026": "入选",
      "brand-coke-fizzion-2025": "入选",
      "ip-coke-holidays-2025": "未处理",
      "image-therealreal-auth-2025": "未处理"
    });
    const importFile = path.join(os.tmpdir(), "selector-import.json");
    fs.writeFileSync(importFile, JSON.stringify(transfer));
    await evaluate(cdp, sessionId, "document.querySelector('[data-filter-group=\"status\"] button[data-value=\"all\"]').click()");
    const doc = await cdp.send("DOM.getDocument", {}, sessionId);
    const found = await cdp.send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: "#import-file" }, sessionId);
    await cdp.send("DOM.setFileInputFiles", { files: [importFile], nodeId: found.nodeId }, sessionId);
    await new Promise((resolve) => setTimeout(resolve, 300));
    const imported = await evaluate(cdp, sessionId, "({msg: document.getElementById('io-msg').textContent, loreal: document.querySelector('#image-loreal-cisce-2026 button[aria-pressed=\"true\"]').getAttribute('data-status'), unilever: document.querySelector('#brand-unilever-packaging-2026 button[aria-pressed=\"true\"]').getAttribute('data-status')})");
    check(imported.msg.includes("已导入") && imported.loreal === "入选" && imported.unilever === "暂不考虑", "JSON import writes statuses into this browser");
    await shot(cdp, sessionId, "/opt/cursor/artifacts/selector-360.png");

    const pageText = await evaluate(cdp, sessionId, "document.body.innerText");
    for (const phrase of PHRASES) {
      if (pageText.includes(phrase)) failures.push("rendered page contains a removed phrase");
    }
    check(pageText.includes("局限") && pageText.includes("主来源"), "page still shows limitations and sources");
  } finally {
    cdp.close();
    chrome.proc.kill("SIGKILL");
    fs.rmSync(userDir, { recursive: true, force: true });
  }
}

scanSite();
logicTests();
const server = await serve(root);
try {
  const origin = "http://127.0.0.1:" + server.address().port;
  await browserTests(origin);
} finally {
  server.close();
}

if (failures.length) {
  console.error(failures.length + " failed");
  process.exit(1);
}
console.log("all checks passed");
