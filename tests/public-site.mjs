import { createRequire } from "node:module";
import { spawn, spawnSync } from "node:child_process";
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
  ["de", "wu"].join(""),
  ["NO", "NO"].join(""),
  ["NI", "NI"].join(""),
  ["Ha", "o"].join(""),
  ["T", "7"].join(""),
  ["20", "27"].join(""),
  chars(0x4e13, 0x9879),
  chars(0x63d0, 0x6848),
  chars(0x5019, 0x9009, 0x7814, 0x7a76, 0x65b9, 0x5411),
  ["/Us", "ers/"].join(""),
  ["/ho", "me/"].join(""),
  ["private-book", "let"].join("")
];

const SITE_FILES = [
  "index.html",
  "README.md",
  "evidence.json",
  "evidence.csv",
  "assets/app.js",
  "assets/styles.css",
  "assets/favicon.svg",
  ".github/workflows/pages.yml",
  "tools/bundle-local.mjs"
];

const data = JSON.parse(fs.readFileSync(path.join(root, "evidence.json"), "utf8"));
const ids = data.cases.map((item) => item.id);
const ORIGINALS = [
  "ip-coke-holidays-2025",
  "ip-tmall-fuli-2026",
  "brand-coke-fizzion-2025",
  "brand-unilever-packaging-2026",
  "image-loreal-cisce-2026",
  "image-therealreal-auth-2025"
];

function memoryStorage() {
  const bag = new Map();
  return {
    getItem(key) { return bag.has(key) ? bag.get(key) : null; },
    setItem(key, value) { bag.set(key, String(value)); },
    removeItem(key) { bag.delete(key); },
    bag
  };
}

function scanAndLogic() {
  for (const rel of SITE_FILES) {
    const text = fs.readFileSync(path.join(root, rel), "utf8");
    for (const phrase of PHRASES) {
      if (text.toLowerCase().includes(phrase.toLowerCase())) failures.push(rel + " contains a private phrase");
    }
  }
  check(JSON.stringify(ids) === JSON.stringify(ORIGINALS), "six stable public ids");
  check(!Object.prototype.hasOwnProperty.call(data, "directions"), "no proposal block in public evidence");
  for (const category of ["ip", "brand", "image"]) {
    check(data.cases.filter((item) => item.category === category).length === 2, "two cases in " + category);
  }
  const recent = data.cases.filter((item) => api.isRecent(item.date_iso)).map((item) => item.id).sort();
  check(JSON.stringify(recent) === JSON.stringify([
    "brand-unilever-packaging-2026",
    "image-loreal-cisce-2026",
    "ip-tmall-fuli-2026"
  ]), "recent marker matches the six-month window");
  check(api.inWindow("2026-05-19", "6m") === true && api.inWindow("2026-05-18", "6m") === false, "public six-month boundary stays 2026-05-19");
  const privateBasis = { six_months_from: "2026-05-20", twelve_months_from: "2025-11-20" };
  check(api.inWindow("2026-05-19", "6m", privateBasis) === false && api.inWindow("2026-05-20", "6m", privateBasis) === true, "window can follow another recorded basis");
  check(api.preferContain({ caption: "公开的主视觉" }) === true, "poster-like media defaults to contain");
  check(api.preferContain({ caption: "官方频道封面" }) === false, "film still defaults to crop");
  const scale = api.scaleState(data.cases[0]);
  check(scale.unverified === true && scale.label === "规模未核实" && !/\d+\s*\/\s*\d+/.test(scale.label), "scale stays an unverified statement");
  const frontier = api.frontierState(data.cases[0]);
  check(frontier.recorded === false && frontier.text.indexOf("未单列") !== -1, "missing frontier note is explicit");
  const recordedFrontier = api.frontierState({ frontier_mechanism: "连续镜头中的角色一致，不是单张海报。" });
  check(recordedFrontier.recorded === true && recordedFrontier.text.indexOf("连续镜头") === 0, "recorded frontier text is shown as written");
  check(api.evidenceTypeLabel("official_company_statement") === "公司陈述，未独立核验", "company scale claims stay labeled as unverified statements");
  check(api.evidenceTypeLabel("official_page") === "官方页面记录", "official page records keep their own label");
  const storage = memoryStorage();
  storage.setItem(api.KEY, JSON.stringify({ "ip-tmall-fuli-2026": "入选", "image-loreal-cisce-2026": "候补" }));
  const loaded = api.loadMap(storage, ids);
  check(loaded.map["ip-tmall-fuli-2026"] === "入选" && loaded.error === false, "plain localStorage map still loads");
  const wrapped = memoryStorage();
  wrapped.setItem(api.KEY, JSON.stringify({ schema: api.SCHEMA, selections: [{ id: "brand-unilever-packaging-2026", status: "暂不考虑" }] }));
  const migrated = api.loadMap(wrapped, ids);
  check(migrated.map["brand-unilever-packaging-2026"] === "暂不考虑", "wrapped selections migrate into the same key");
  check(api.saveMap(storage, loaded.map) === true, "save still succeeds");
  const saved = JSON.parse(storage.getItem(api.KEY));
  check(saved["ip-tmall-fuli-2026"] === "入选" && !saved.selections, "saved value stays a plain map");
  const exported = api.toExport(data.cases, loaded.map);
  check(exported.schema === api.SCHEMA && exported.selections.length === 6, "JSON export keeps the v1 schema");
  const csv = api.toCsv(exported.selections);
  check(csv.charCodeAt(0) === 0xfeff && csv.includes("天猫") && csv.includes("候补"), "CSV export keeps title, status, and source");
  const imported = api.validateImport(JSON.stringify(exported), ids);
  check(imported.ok && imported.selections.length === 6, "JSON export imports back");
  check(api.validateImport(JSON.stringify({ schema: "other", selections: [] }), ids).ok === false, "unknown schema is rejected");
  check(api.parseCaseHash("#case-ip-tmall-fuli-2026") === "ip-tmall-fuli-2026", "detail hash round-trips");
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
      res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
      res.end(body);
    });
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

function startChrome(userDir) {
  const proc = spawn("google-chrome", [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--allow-file-access-from-files",
    "--remote-debugging-port=0",
    "--user-data-dir=" + userDir,
    "about:blank"
  ], { stdio: ["ignore", "pipe", "pipe"] });
  let buf = "";
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("chrome did not open devtools\n" + buf)), 20000);
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
      reject(new Error("chrome exited " + code + " " + buf));
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
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
  close() { this.ws.close(); }
}

async function evaluate(cdp, sessionId, expression) {
  const result = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sessionId);
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}

async function waitFor(cdp, sessionId, expression) {
  for (let i = 0; i < 40; i += 1) {
    const ready = await evaluate(cdp, sessionId, expression);
    if (ready) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  const error = await evaluate(cdp, sessionId, "document.getElementById('error') ? document.getElementById('error').textContent : document.body.innerText.slice(0, 300)");
  throw new Error("page not ready " + error);
}

async function openAt(cdp, sessionId, url, width) {
  await cdp.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 800 }, sessionId);
  await cdp.send("Page.navigate", { url }, sessionId);
  await waitFor(cdp, sessionId, "document.querySelectorAll('article.card').length === 6 && document.getElementById('loading').hidden");
}

async function shot(cdp, sessionId, file) {
  await evaluate(cdp, sessionId, "Promise.all([...document.images].filter((img) => img.getAttribute('src') && img.getBoundingClientRect().bottom > 0 && img.getBoundingClientRect().top < innerHeight).map((img) => (img.decode ? img.decode() : Promise.resolve()).catch(() => {}))).then(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))");
  const image = await cdp.send("Page.captureScreenshot", { format: "png" }, sessionId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
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

    await openAt(cdp, sessionId, origin + "/", 360);
    const narrow = await evaluate(cdp, sessionId, `({
      width: window.innerWidth,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      filtersHidden: document.getElementById('filters').hidden,
      expanded: document.getElementById('filter-toggle').getAttribute('aria-expanded'),
      recent: Array.from(document.querySelectorAll('article.card .recent')).map((node) => node.closest('article').getAttribute('data-case-id')).sort(),
      counts: Object.fromEntries(Array.from(document.querySelectorAll('[data-count-for]')).map((node) => [node.getAttribute('data-count-for'), node.textContent])),
      cats: Object.fromEntries(['ip','brand','image'].map(function (cat) { return [cat, document.querySelectorAll('article.card[data-category="' + cat + '"]').length]; })),
      contain: document.querySelector('#card-ip-tmall-fuli-2026 .shot').classList.contains('is-contain'),
      crop: document.querySelector('#card-ip-coke-holidays-2025 .shot').classList.contains('is-contain'),
      lead: document.getElementById('book-lead').textContent,
      newWord: document.body.innerText.includes('NEW')
    })`);
    check(narrow.width === 360, "viewport is 360");
    check(narrow.overflow <= 1, "no page overflow at 360");
    check(narrow.filtersHidden === true && narrow.expanded === "false", "filters start collapsed on a narrow screen");
    check(JSON.stringify(narrow.recent) === JSON.stringify(["brand-unilever-packaging-2026", "image-loreal-cisce-2026", "ip-tmall-fuli-2026"]), "only dated recent cases are marked");
    check(narrow.counts["未处理"] === "6" && narrow.counts["入选"] === "0", "status counts start untreated");
    check(narrow.cats.ip === 2 && narrow.cats.brand === 2 && narrow.cats.image === 2, "two cards in each category");
    check(narrow.contain === true && narrow.crop === false, "poster uses contain and a film still stays cropped");
    check(narrow.lead.includes("挑选只保存在这台浏览器") && narrow.newWord === false, "lead explains local selection without a fake new flag");
    await shot(cdp, sessionId, "/opt/cursor/artifacts/public-list-360.png");

    await evaluate(cdp, sessionId, "document.getElementById('filter-toggle').click()");
    const opened = await evaluate(cdp, sessionId, "({hidden: document.getElementById('filters').hidden, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth})");
    check(opened.hidden === false && opened.overflow <= 1, "opened filters stay inside 360");
    await evaluate(cdp, sessionId, "document.querySelector('[data-filter-group=\"category\"] button[data-value=\"ip\"]').click()");
    const ipOnly = await evaluate(cdp, sessionId, "Array.from(document.querySelectorAll('article.card')).filter((node) => !node.hidden).map((node) => node.getAttribute('data-case-id')).sort()");
    check(ipOnly.length === 2, "category filter shows two IP cases");
    await evaluate(cdp, sessionId, "document.getElementById('reset-filters').click()");

    await evaluate(cdp, sessionId, "document.querySelector('#card-ip-tmall-fuli-2026 button[data-status=\"入选\"]').click(); document.querySelector('#card-brand-unilever-packaging-2026 button[data-status=\"入选\"]').click(); document.querySelector('#card-image-loreal-cisce-2026 button[data-status=\"候补\"]').click(); document.querySelector('#card-ip-coke-holidays-2025 button[data-status=\"暂不考虑\"]').click();");
    const after = await evaluate(cdp, sessionId, "Object.fromEntries(Array.from(document.querySelectorAll('[data-count-for]')).map((node) => [node.getAttribute('data-count-for'), node.textContent]))");
    check(after["入选"] === "2" && after["候补"] === "1" && after["暂不考虑"] === "1" && after["未处理"] === "2", "status counts follow the four choices");
    await evaluate(cdp, sessionId, "document.querySelector('[data-filter-group=\"status\"] button[data-value=\"入选\"]').click()");
    const picked = await evaluate(cdp, sessionId, "Array.from(document.querySelectorAll('article.card')).filter((node) => !node.hidden).map((node) => node.getAttribute('data-case-id')).sort()");
    check(JSON.stringify(picked) === JSON.stringify(["brand-unilever-packaging-2026", "ip-tmall-fuli-2026"]), "入选 filter shows the two selected cases");
    await evaluate(cdp, sessionId, "document.querySelector('[data-filter-group=\"status\"] button[data-value=\"all\"]').click()");
    await evaluate(cdp, sessionId, "document.getElementById('q').value = 'zzzz-no-match'; document.getElementById('q').dispatchEvent(new Event('input', { bubbles: true }))");
    const empty = await evaluate(cdp, sessionId, "document.getElementById('empty').hidden === false && !!document.getElementById('empty-reset')");
    check(empty === true, "empty search offers a reset");
    await evaluate(cdp, sessionId, "document.getElementById('empty-reset').click()");
    const restored = await evaluate(cdp, sessionId, "({shown: Array.from(document.querySelectorAll('article.card')).filter((node) => !node.hidden).length, status: document.querySelector('#card-ip-tmall-fuli-2026 .stamp[aria-pressed=\"true\"]').getAttribute('data-status'), query: document.getElementById('q').value})");
    check(restored.shown === 6 && restored.status === "入选" && restored.query === "", "reset clears the search and keeps the shortlist " + JSON.stringify(restored));

    await evaluate(cdp, sessionId, "document.querySelector('#card-ip-tmall-fuli-2026 .title-link').click()");
    await waitFor(cdp, sessionId, "document.getElementById('reader') && !document.getElementById('reader').hidden && document.getElementById('reader-title')");
    const detail = await evaluate(cdp, sessionId, `({
      hash: location.hash,
      title: document.getElementById('reader-title').textContent,
      sections: Array.from(document.querySelectorAll('#reader h2')).map((node) => node.textContent),
      scale: document.querySelector('#reader .unverified') ? document.querySelector('#reader .unverified').textContent : '',
      frontier: document.querySelector('#reader .unrecorded') ? document.querySelector('#reader .unrecorded').textContent : '',
      pressed: document.querySelector('#reader .stamp[aria-pressed="true"]').getAttribute('data-status'),
      source: !!document.querySelector('#reader .src-list a[href^="http"]'),
      note: document.getElementById('reader-warn').textContent,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      picture: document.querySelector('#reader img') ? document.querySelector('#reader img').naturalWidth : 0,
      ready: document.querySelector('#reader .shot').classList.contains('is-ready')
    })`);
    check(detail.hash === "#case-ip-tmall-fuli-2026", "detail address keeps the stable id");
    check(detail.title.includes("天猫"), "detail shows the case title");
    check(detail.picture > 0 && detail.ready === true, "detail picture decoded " + JSON.stringify({ picture: detail.picture, ready: detail.ready }));
    check(JSON.stringify(detail.sections) === JSON.stringify(["AI机制", "前沿性", "规模证据", "对标价值", "受众与触点", "来源与局限"]), "evidence sections follow the reading order");
    check(detail.scale === "规模未核实" && detail.frontier.includes("未单列"), "scale and frontier stay honest");
    check(detail.pressed === "入选" && detail.source === true && detail.note.includes("这台浏览器"), "shortlist and sources stay on the detail");
    check(detail.overflow <= 1, "detail does not overflow at 360");

    await openAt(cdp, sessionId, origin + "/#case-ip-tmall-fuli-2026", 390);
    const refreshed = await evaluate(cdp, sessionId, "({width: window.innerWidth, open: !document.getElementById('reader').hidden, status: document.querySelector('#reader .stamp[aria-pressed=\"true\"]').getAttribute('data-status'), overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth})");
    check(refreshed.width === 390 && refreshed.open === true && refreshed.status === "入选", "detail and selection survive refresh " + JSON.stringify(refreshed));
    check(refreshed.overflow <= 1, "no page overflow at 390");
    await evaluate(cdp, sessionId, "window.scrollTo(0, 0)");
    await shot(cdp, sessionId, "/opt/cursor/artifacts/public-detail-390.png");
    await evaluate(cdp, sessionId, "document.getElementById('back').click()");
    await waitFor(cdp, sessionId, "document.getElementById('reader').hidden && document.getElementById('card-ip-tmall-fuli-2026')");
    await new Promise((resolve) => setTimeout(resolve, 50));
    const back = await evaluate(cdp, sessionId, "({hash: location.hash, top: document.getElementById('card-ip-tmall-fuli-2026').getBoundingClientRect().top, scroll: window.scrollY, visible: document.getElementById('card-ip-tmall-fuli-2026').hidden === false})");
    check(back.hash.indexOf("#card-ip-tmall-fuli-2026") === 0 && back.visible === true && back.top > -40 && back.top < 220, "return lands on the same case " + JSON.stringify(back));

    await evaluate(cdp, sessionId, "document.querySelector('#card-ip-coke-holidays-2025 img').src = 'assets/missing-file.jpg'");
    await new Promise((resolve) => setTimeout(resolve, 400));
    const failed = await evaluate(cdp, sessionId, "({failed: document.querySelector('#card-ip-coke-holidays-2025 .shot').classList.contains('is-failed'), text: document.querySelector('#card-ip-coke-holidays-2025 .shot').innerText, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth})");
    check(failed.failed === true && failed.text.includes("图片未能显示") && failed.overflow <= 1, "a failed image keeps its frame and link");

    await evaluate(cdp, sessionId, "localStorage.setItem('ai-brand-case-selection-v1', JSON.stringify({'image-loreal-cisce-2026':'候补'})); location.href = location.pathname;");
    await waitFor(cdp, sessionId, "document.querySelectorAll('article.card').length === 6 && document.querySelector('#card-image-loreal-cisce-2026 button[aria-pressed=\"true\"]')");
    const migrated = await evaluate(cdp, sessionId, "document.querySelector('#card-image-loreal-cisce-2026 button[aria-pressed=\"true\"]').getAttribute('data-status')");
    check(migrated === "候补", "an existing plain selection map is kept after reload");

    await evaluate(cdp, sessionId, "document.getElementById('export-csv').click(); document.getElementById('export-json').click();");
    const io = await evaluate(cdp, sessionId, "document.getElementById('io-msg').textContent");
    check(io.includes("JSON"), "export controls run in the page");
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
    const docNode = await cdp.send("DOM.getDocument", {}, sessionId);
    const found = await cdp.send("DOM.querySelector", { nodeId: docNode.root.nodeId, selector: "#import-file" }, sessionId);
    await cdp.send("DOM.setFileInputFiles", { files: [importFile], nodeId: found.nodeId }, sessionId);
    await new Promise((resolve) => setTimeout(resolve, 400));
    const importedUi = await evaluate(cdp, sessionId, "({msg: document.getElementById('io-msg').textContent, loreal: document.querySelector('#card-image-loreal-cisce-2026 button[aria-pressed=\"true\"]').getAttribute('data-status'), unilever: document.querySelector('#card-brand-unilever-packaging-2026 button[aria-pressed=\"true\"]').getAttribute('data-status')})");
    check(importedUi.msg.includes("已导入") && importedUi.loreal === "入选" && importedUi.unilever === "暂不考虑", "JSON import writes statuses for the stable ids");

    await openAt(cdp, sessionId, origin + "/", 1280);
    const wide = await evaluate(cdp, sessionId, "({width: window.innerWidth, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, filters: document.getElementById('filters').hidden, resources: performance.getEntriesByType('resource').map((entry) => entry.name)})");
    check(wide.width === 1280 && wide.overflow <= 1 && wide.filters === false, "desktop shows filters without horizontal overflow");
    check(wide.resources.every((name) => name.startsWith(origin)), "page only loads same-origin files");
    const pageText = await evaluate(cdp, sessionId, "document.body.innerText");
    for (const phrase of PHRASES) {
      if (pageText.toLowerCase().includes(phrase.toLowerCase())) failures.push("rendered page contains a private phrase");
    }
    await shot(cdp, sessionId, "/opt/cursor/artifacts/public-list-1280.png");
  } finally {
    cdp.close();
    chrome.proc.kill("SIGKILL");
    fs.rmSync(userDir, { recursive: true, force: true });
  }
}

async function bundleFile() {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "public-bundle-"));
  const result = spawnSync("node", [
    "tools/bundle-local.mjs",
    "--data", "evidence.json",
    "--assets", "assets",
    "--js", "assets/app.js",
    "--css", "assets/styles.css",
    "--template", "index.html",
    "--out", out,
    "--standalone", "standalone.html"
  ], { cwd: root, encoding: "utf8" });
  check(result.status === 0, "local bundle script exits cleanly");
  const html = fs.readFileSync(path.join(out, "index.html"), "utf8");
  check(html.includes("casebook-data") && !html.includes("private-book"), "bundle embeds data for file opening");
  for (const phrase of PHRASES) {
    if (html.toLowerCase().includes(phrase.toLowerCase())) failures.push("public bundle contains a private phrase");
  }
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), "bundle-chrome-"));
  const chrome = await startChrome(userDir);
  const cdp = new Cdp(chrome.browserUrl);
  try {
    await cdp.open();
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    await cdp.send("Page.enable", {}, sessionId);
    await cdp.send("Runtime.enable", {}, sessionId);
    const url = "file://" + path.join(out, "index.html");
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 800, deviceScaleFactor: 1, mobile: true }, sessionId);
    await cdp.send("Page.navigate", { url }, sessionId);
    await waitFor(cdp, sessionId, "document.querySelectorAll('article.card').length === 6 && document.getElementById('loading').hidden");
    const offline = await evaluate(cdp, sessionId, "document.getElementById('error') ? document.getElementById('error').textContent : ''");
    check(offline === "", "bundled file opens without fetching evidence.json");
  } finally {
    cdp.close();
    chrome.proc.kill("SIGKILL");
    fs.rmSync(userDir, { recursive: true, force: true });
  }
}

scanAndLogic();
const server = await serve(root);
try {
  await browserTests("http://127.0.0.1:" + server.address().port);
  await bundleFile();
} finally {
  server.close();
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("all checks passed");
