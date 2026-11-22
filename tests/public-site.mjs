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
  chars(0x5019, 0x9009, 0x4e13, 0x9879),
  chars(0x4e92, 0x8054, 0x5b9d, 0x5730),
  chars(0x9274, 0x522b, 0x5361),
  chars(0x7b7e, 0x6536, 0x4f53, 0x9a8c),
  ["#00D", "0DB"].join(""),
  ["00D", "0DB"].join(""),
  ["/Us", "ers/"].join(""),
  ["/ho", "me/"].join(""),
  ["/cursor/", "stores"].join(""),
  ["private-book", "let"].join(""),
  ["private-out", "put"].join("")
];

function textFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...textFiles(full));
    else if (/\.(html|md|json|csv|js|mjs|css|yml|svg|txt)$/i.test(entry.name)) out.push(full);
  }
  return out;
}

function hasPrivatePhrase(text, phrase) {
  const hay = String(text).toLowerCase();
  const needle = String(phrase).toLowerCase();
  const seasonYear = ["20", "27"].join("");
  if (needle === seasonYear) return hay.split(seasonYear + "/28").join("").includes(seasonYear);
  return hay.includes(needle);
}

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
const ADDITIONS = [
  "ip-fanta-haunted-2026",
  "ip-bluemoon-jingjing-2026",
  "ip-jingpai-jiuling-2026",
  "ip-unisport-zoai-2026",
  "ip-coke-fanzhiyi-2026",
  "ip-adidas-backyard-2026",
  "brand-anta-ai365-2026",
  "image-zhuanzhuan-aiauth-2026",
  "ip-mikkeller-switchhit-2026",
  "ip-meitu-mcd-ppg-2025",
  "brand-loreal-creaitech-2026",
  "image-lv-comelz-2026",
  "image-kerastase-kscan-2026",
  "image-sephora-chatgpt-2026"
];
const ADDED = [
  "brand-puma-aicreator-2026",
  "brand-zalando-aicontent-2026",
  "image-florasis-sensory-2026"
];
const ALL_IDS = ORIGINALS.concat(ADDITIONS, ADDED);
const RECENT_IDS = [
  "brand-anta-ai365-2026",
  "brand-loreal-creaitech-2026",
  "brand-puma-aicreator-2026",
  "brand-unilever-packaging-2026",
  "image-florasis-sensory-2026",
  "image-kerastase-kscan-2026",
  "image-loreal-cisce-2026",
  "image-lv-comelz-2026",
  "ip-bluemoon-jingjing-2026",
  "ip-coke-fanzhiyi-2026",
  "ip-fanta-haunted-2026",
  "ip-jingpai-jiuling-2026",
  "ip-tmall-fuli-2026",
  "ip-unisport-zoai-2026"
];
const NINETY_IDS = [
  "brand-puma-aicreator-2026",
  "image-florasis-sensory-2026",
  "ip-bluemoon-jingjing-2026",
  "ip-fanta-haunted-2026",
  "ip-jingpai-jiuling-2026",
  "ip-tmall-fuli-2026"
];
const LINK_ONLY = [
  "ip-bluemoon-jingjing-2026",
  "ip-jingpai-jiuling-2026",
  "ip-coke-fanzhiyi-2026"
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

const ADVICE = {
  "ip-coke-holidays-2025": "若校准自有角色，优先做“同一角色在多镜头、多情绪、多场景中保持可识别”的叙事短片，而不是再做一个新形象。先写角色圣经和禁用项，再允许AI执行。节日或大促档期上线前，单独评估“看起来像AI”对鉴别与潮流信任的副作用。用户可先在活动页或视频渠道看到短片，再进入角色相关的商品或内容集合；不把“看起来像AI”本身当成卖点。建议先做30–60秒样片，盲测“是否还是同一只角色、是否像廉价生成”，不通过则停止扩写正片。",
  "ip-tmall-fuli-2026": "可对照自有角色做“有性格的主角+商家/品类伙伴客串”的短剧校准，而不是先扩出全新家族。先定义角色可表演的性格与情绪，再谈AI同框。授权与品牌安全要先行，否则多IP同框会先在法务和规范上失败。故事主线、价值观和任何涉及鉴别结论的台词必须人工写、人工审，不能用AI直接做真伪判决台词。建议先做3集样片看完播与“角色是否可识别”，完播差或人设漂移则停。",
  "brand-coke-fizzion-2025": "若做可治理的视觉系统，建议先把现有品牌规范（含包装、卡片、中英标志组合）整理成可抽检的规则，再试点“设计系统+生成变体+人工放行”。不要从自动改logo开始。不要把未核实色值写进系统当官方色。2026-07-20可口可乐另发全球视觉识别升级，官方只写Brand Center与tech-powered Design Intelligence tools，未点名Fizzion或AI。两篇稿可对照，不能直接画等号。",
  "brand-unilever-packaging-2026": "自有或联名包装、卡片、开箱物料可对照做“概念到结构到货架/开箱”的试点，而不是先批量生成节日包装图案。先固化品牌色、标志安全区、材料与开盒动线，再让AI在约束里出方案。官方效率数字只可作量级参考，不可写入承诺。结构安全、法规字样、最终打样必须人工与工艺确认。",
  "image-loreal-cisce-2026": "建议把鉴别、仓储、物流、质检里已经真实存在的能力，做成用户能看懂的解释，而不是再做数字人形象。可试点“开箱之前看见这条链”的短内容，素材必须来自真实流程。AI漫剧可以作传播外壳，但鉴别结论不能由漫剧角色宣布。不能用生成影像假充真实质检现场。",
  "image-therealreal-auth-2025": "建议对外只说清“AI做什么、人做什么、哪一步不可替代”。不要用数字人或头像承载鉴别承诺。可把过程可视化（拍摄、比对、专家签字、证书），让专业被看见。任何准确率数字都必须可追溯到官方或可复核实验，不能写在营销超级符号上。终检必须是有资格的人；不能把未独立核验的准确率写进对用户承诺。"
};

function scanAndLogic() {
  for (const file of textFiles(root)) {
    const text = fs.readFileSync(file, "utf8");
    const rel = path.relative(root, file);
    for (const phrase of PHRASES) {
      if (hasPrivatePhrase(text, phrase)) failures.push(rel + " contains a private phrase");
    }
  }
  check(JSON.stringify(ids) === JSON.stringify(ALL_IDS), "ids keep the original order and append the three new cases");
  check(new Set(ids).size === 23 && ids.length === 23, "twenty-three unique ids");
  for (const id of ADDED) check(ids.includes(id), "new case is present " + id);
  check(data.cases.slice(0, 20).every((item) => item.verified_on !== "2026-11-22"), "original cases keep their verification dates");
  const addedById = Object.fromEntries(data.cases.slice(20).map((item) => [item.id, item]));
  check(addedById["brand-puma-aicreator-2026"].date_iso === "2026-08-27" && addedById["brand-puma-aicreator-2026"].category === "brand" && addedById["brand-puma-aicreator-2026"].confidence === "high", "puma case keeps the verified facts");
  check(addedById["brand-zalando-aicontent-2026"].date_iso === "2026-05-06" && addedById["brand-zalando-aicontent-2026"].category === "brand" && addedById["brand-zalando-aicontent-2026"].confidence === "high", "zalando case keeps the verified facts");
  check(addedById["image-florasis-sensory-2026"].date_iso === "2026-09-23" && addedById["image-florasis-sensory-2026"].category === "image" && addedById["image-florasis-sensory-2026"].confidence === "midhigh", "florasis case keeps the verified facts");
  check(addedById["brand-puma-aicreator-2026"].limits.includes("professional football") && addedById["brand-zalando-aicontent-2026"].limits.includes("不包括商品详情页") && addedById["image-florasis-sensory-2026"].limits.includes("不是日常零售门店已铺开"), "new cases keep the evidence guards");
  for (const item of data.cases) {
    if (ADVICE[item.id]) check(item.advice === ADVICE[item.id], "stored suggestion matches the public copy for " + item.id);
    else check(typeof item.advice === "string" && item.advice.includes("建议，非已落地"), "added suggestion keeps the public marker for " + item.id);
  }
  check(!Object.prototype.hasOwnProperty.call(data, "directions"), "no proposal block in public evidence");
  const expectedCounts = { ip: 10, brand: 6, image: 7 };
  for (const category of ["ip", "brand", "image"]) {
    check(data.cases.filter((item) => item.category === category).length === expectedCounts[category], expectedCounts[category] + " cases in " + category);
  }
  const recent = data.cases.filter((item) => api.isRecent(item.date_iso)).map((item) => item.id).sort();
  check(JSON.stringify(recent) === JSON.stringify(RECENT_IDS), "recent marker matches the default six-month window");
  const basis = api.basisOf(data);
  check(basis.six_months_from === "2026-05-21" && basis.filter_six_months_from === "2026-05-21" && basis.twelve_months_from === "2025-11-21" && basis.filter_twelve_months_from === "2025-11-21" && basis.ninety_days_from === "2026-08-23", "site filters use the 2026-11-21 basis");
  check(api.inWindow("2026-05-21", "6m", basis) === true && api.inWindow("2026-05-20", "6m", basis) === false, "site six-month boundary is 2026-05-21");
  const siteRecent = data.cases.filter((item) => api.isRecent(item.date_iso, basis)).map((item) => item.id).sort();
  check(JSON.stringify(siteRecent) === JSON.stringify(RECENT_IDS), "site recent marker matches the current twenty-three");
  check(data.verified_on === "2026-11-22" && data.selected_count === 23, "site count and date are updated");
  check(data.lead.includes("二十三例") && data.lead.includes("挑选只保存在这台浏览器"), "lead names twenty-three cases");
  check(!data.scope_note.includes("只收6例") && data.scope_note.includes("23例") && data.scope_note.includes("2026-11-22"), "scope describes the twenty-three case set");
  const appendixText = JSON.stringify(data.appendix);
  check(!appendixText.includes("未计入6例") && !appendixText.includes("不计入6例") && !appendixText.includes("不凑进6例"), "appendix drops the six-case exclusion wording");
  check(appendixText.includes("看球搭子AI范志毅") && appendixText.includes("现已作为案例收入本册"), "fanzhiyi appendix now includes the case");
  check(appendixText.includes("飞天小女警") && appendixText.includes("现已作为案例收入本册"), "meitu appendix now includes the case");
  check(appendixText.includes("质量优先于凑数") && appendixText.includes("professional football") && appendixText.includes("170,000") && appendixText.includes("不能写成日常门店已铺开"), "appendix notes this increment and its evidence guards");
  const publicText = ["evidence.json", "index.html", "assets/app.js", "assets/styles.css", "README.md", "evidence.csv"];
  const privacyTerms = [
    chars(0x5f97, 0x7269),
    ["De", "wu"].join(""),
    ["de", "wu"].join(""),
    ["Ha", "o"].join(""),
    ["NO", "NO"].join(""),
    ["NI", "NI"].join(""),
    ["T", "7"].join(""),
    chars(0x4e92, 0x8054, 0x5b9d, 0x5730),
    chars(0x9274, 0x522b, 0x5361),
    chars(0x7b7e, 0x6536, 0x4f53, 0x9a8c),
    ["#00D", "0DB"].join(""),
    chars(0x4e13, 0x9879)
  ];
  let privacyHits = 0;
  for (const rel of publicText) {
    const text = fs.readFileSync(path.join(root, rel), "utf8");
    for (const phrase of privacyTerms) {
      if (text.toLowerCase().includes(phrase.toLowerCase())) {
        privacyHits += 1;
        failures.push(rel + " privacy hit");
      }
    }
  }
  check(privacyHits === 0, "privacy scan over public text has zero hits");
  const seasonYear = ["20", "27"].join("");
  const seasonToken = seasonYear + "/28";
  let seasonHits = 0;
  let otherYear = false;
  for (const file of textFiles(root)) {
    const text = fs.readFileSync(file, "utf8");
    const parts = text.split(seasonToken);
    seasonHits += parts.length - 1;
    if (parts.join("").includes(seasonYear)) otherYear = true;
  }
  check(seasonHits === 3 && otherYear === false, "the only year-marker hits are the public kit season citation");
  check(data.cases[0].window_note.startsWith("距核验日约12个半月"), "original holiday window note stays");
  check(data.cases[5].window_note.includes("2026-11-19仍把Shield"), "original authentication window note stays");
  for (const id of LINK_ONLY) {
    const item = data.cases.find((entry) => entry.id === id);
    check(item && item.media.length === 0 && item.media_links.length > 0, "link-only case keeps source links and no stills for " + id);
  }
  for (const item of data.cases) {
    for (const media of item.media || []) {
      check(fs.existsSync(path.join(root, media.file)), "referenced still exists " + media.file);
    }
  }
  const kera = data.cases.find((item) => item.id === "image-kerastase-kscan-2026");
  check(kera.media[0].caption.includes("不是诊断结果界面") && kera.media[1].caption.includes("不能仅凭外形把其中某一件指认为K-SCAN"), "kerastase stills stay equipment photos");
  check(kera.limits.includes("9,000家沙龙与12,000张训练图像均为公司陈述") && kera.scale_evidence[1].claim.includes("不是沙龙数量"), "kerastase salon and training figures stay separate");
  const sephora = data.cases.find((item) => item.id === "image-sephora-chatgpt-2026");
  check(sephora.limits.includes("不是本应用活跃用户") && sephora.scale_limits.includes("不得用全球会员总数代表本试点规模") && sephora.window_note.includes("美国试点"), "sephora membership stays separate from the pilot");
  const lv = data.cases.find((item) => item.id === "image-lv-comelz-2026");
  check(lv.media[0].caption.includes("不是工厂量产车间照片") && lv.summary.includes("VivaTech 2026"), "lv remains an exhibition demo");
  const csvRows = fs.readFileSync(path.join(root, "evidence.csv"), "utf8").trim().split(/\n/);
  check(csvRows.length === 24 && csvRows[1].startsWith("ip-coke-holidays-2025,") && csvRows[20].startsWith("image-sephora-chatgpt-2026,") && csvRows[21].startsWith("brand-puma-aicreator-2026,") && csvRows[22].startsWith("brand-zalando-aicontent-2026,") && csvRows[23].startsWith("image-florasis-sensory-2026,"), "csv keeps the original rows and lists all twenty-three");
  check(csvRows[21].includes(",increment-2026-11-22,90d,2026-11-22") && csvRows[22].includes(",increment-2026-11-22,12m,2026-11-22") && csvRows[23].includes(",increment-2026-11-22,90d,2026-11-22"), "csv rows record round, window, and verification date");
  const appSource = fs.readFileSync(path.join(root, "assets/app.js"), "utf8");
  const css = fs.readFileSync(path.join(root, "assets/styles.css"), "utf8");
  check(css.includes("Songti SC") && css.includes("PingFang SC") && css.includes("Noto Serif CJK SC") && css.includes("Noto Sans CJK SC") && css.includes("Source Han Serif SC") && css.includes("Source Han Sans SC"), "cjk stack names faces that exist on phones");
  check(!css.includes("fonts.googleapis.com") && !css.includes("fonts.gstatic.com") && !css.includes("WenQuanYi"), "type does not call a font host or a desktop-only family");
  check(css.includes("source-serif-4-latin-400.woff2") && css.includes("source-serif-4-latin-600.woff2"), "latin display face is referenced locally");
  check(fs.existsSync(path.join(root, "assets/fonts/source-serif-4-latin-400.woff2")) && fs.existsSync(path.join(root, "assets/fonts/source-serif-4-latin-600.woff2")), "latin display files are in the repo");
  check(css.includes("prefers-reduced-motion") && css.includes(":focus-visible") && css.includes(":focus:not(:focus-visible)"), "focus and reduced motion stay explicit");
  check(appSource.includes('var KEY = "ai-brand-case-selection-v1"') && appSource.includes('var SCHEMA = "ai-brand-case-selection/v1"') && appSource.includes('var SCROLL_KEY = "ai-brand-case-return-v1"'), "selection storage keys stay literal");
  check(appSource.includes('var CALIBRATION_KEY = "ai-brand-case-calibration-v1"') && appSource.includes('var CALIBRATION_SCHEMA = "ai-brand-case-calibration/v1"'), "calibration storage key uses an isolated schema");
  check(appSource.includes("画面载入中") && appSource.includes("图片未能显示") && appSource.includes("建议，非已落地") && appSource.includes('section("对标建议"'), "existing labels stay");
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
  check(exported.schema === api.SCHEMA && exported.selections.length === 23, "JSON export keeps the v1 schema");
  const csv = api.toCsv(exported.selections);
  check(csv.charCodeAt(0) === 0xfeff && csv.includes("天猫") && csv.includes("候补"), "CSV export keeps title, status, and source");
  const imported = api.validateImport(JSON.stringify(exported), ids);
  check(imported.ok && imported.selections.length === 23, "JSON export imports back");
  check(api.validateImport(JSON.stringify({ schema: "other", selections: [] }), ids).ok === false, "unknown schema is rejected");
  const calStorage = memoryStorage();
  const calSeed = {
    schema: api.CALIBRATION_SCHEMA,
    updated_at: "2026-11-22T00:00:00.000Z",
    answers: {
      goals: ["ip-vivid", "brand-consistent"],
      "exclude-forms": ["exclude-none", "exclude-short-film"]
    }
  };
  calStorage.setItem(api.CALIBRATION_KEY, JSON.stringify(calSeed));
  const loadedCal = api.loadCalibration(calStorage);
  check(loadedCal.error === false, "calibration data loads");
  check((loadedCal.data.answers.goals || []).length === 2, "calibration keeps multi-select choices");
  check(JSON.stringify(loadedCal.data.answers["exclude-forms"]) === JSON.stringify(["exclude-none"]), "exclusive exclusion answer trims other options");
  check(api.saveCalibration(calStorage, loadedCal.data) === true, "calibration save succeeds");
  const calExport = api.calibrationExportData(loadedCal.data);
  check(calExport.schema === api.CALIBRATION_SCHEMA && calExport.answers.goals.length === 2, "calibration export uses the isolated schema");
  check(api.validateCalibrationImport(JSON.stringify(calExport)).ok === true, "calibration export re-imports");
  check(api.validateCalibrationImport(JSON.stringify({ schema: api.SCHEMA, answers: {} })).ok === false, "wrong schema is rejected for calibration import");
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
  await waitFor(cdp, sessionId, "document.querySelectorAll('article.card').length === 23 && document.getElementById('loading').hidden");
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
      tight: Array.from(document.querySelectorAll('article.card .recent-tight')).map((node) => node.closest('article').getAttribute('data-case-id')).sort(),
      counts: Object.fromEntries(Array.from(document.querySelectorAll('[data-count-for]')).map((node) => [node.getAttribute('data-count-for'), node.textContent])),
      count: document.getElementById('count').textContent,
      hint: document.getElementById('time-hint').textContent,
      appendix: document.getElementById('lim-list').textContent,
      cats: Object.fromEntries(['ip','brand','image'].map(function (cat) { return [cat, document.querySelectorAll('article.card[data-category="' + cat + '"]').length]; })),
      contain: document.querySelector('#card-ip-tmall-fuli-2026 .shot').classList.contains('is-contain'),
      crop: document.querySelector('#card-ip-coke-holidays-2025 .shot').classList.contains('is-contain'),
      lead: document.getElementById('book-lead').textContent,
      newWord: document.body.innerText.includes('NEW')
    })`);
    const barBox = await evaluate(cdp, sessionId, `document.fonts.ready.then(() => {
      const bar = document.getElementById("sticky").getBoundingClientRect();
      return {
        h: Math.round(bar.height),
        vh: window.innerHeight,
        title: getComputedStyle(document.getElementById("book-title")).fontFamily,
        body: getComputedStyle(document.body).fontFamily,
        font: document.fonts.check('600 32px "Source Serif 4"')
      };
    })`);
    check(barBox.h < 170 && barBox.h < barBox.vh * 0.34, "collapsed bar stays compact " + JSON.stringify(barBox));
    check(barBox.title.includes("Source Serif 4") && barBox.title.includes("Songti SC") && barBox.title.includes("Noto Serif CJK SC"), "title stack is the self-hosted latin face then songti");
    check(barBox.body.includes("PingFang SC") && barBox.body.includes("Noto Sans CJK SC") && barBox.body.includes("Source Han Sans SC"), "body stack names phone sans faces");
    check(barBox.font === true, "self-hosted semibold face loaded");
    check(narrow.width === 360, "viewport is 360");
    check(narrow.overflow <= 1, "no page overflow at 360");
    check(narrow.filtersHidden === true && narrow.expanded === "false", "filters start collapsed on a narrow screen");
    check(JSON.stringify(narrow.recent) === JSON.stringify(RECENT_IDS), "recent marks follow the site six-month window");
    check(JSON.stringify(narrow.tight) === JSON.stringify(NINETY_IDS), "ninety-day marks follow the site date");
    check(narrow.counts["未处理"] === "23" && narrow.counts["入选"] === "0", "status counts start untreated");
    check(narrow.cats.ip === 10 && narrow.cats.brand === 6 && narrow.cats.image === 7, "category counts match the twenty-three cases");
    check(narrow.count === "显示 23 / 23", "count shows twenty-three cases");
    check(narrow.hint.includes("2026-05-21") && narrow.hint.includes("2026-11-21"), "time hint documents the site date");
    check(narrow.appendix.includes("现已作为案例收入本册") && !narrow.appendix.includes("未计入6例") && !narrow.appendix.includes("不计入6例"), "appendix includes the former exclusions");
    check(narrow.contain === true && narrow.crop === false, "poster uses contain and a film still stays cropped");
    check(narrow.lead.includes("挑选只保存在这台浏览器") && narrow.lead.includes("二十三例") && narrow.newWord === false, "lead explains twenty-three local cases without a fake new flag");
    const addedCards = await evaluate(cdp, sessionId, `Promise.all(${JSON.stringify(ADDED)}.map(async (id) => {
      const img = document.querySelector("#card-" + id + " img");
      if (img && img.decode) { try { await img.decode(); } catch (err) {} }
      const teaser = document.querySelector("#card-" + id + " .advice-teaser");
      return { id, width: img ? img.naturalWidth : 0, advice: teaser ? teaser.textContent : "", title: document.querySelector("#card-" + id + " .title-link") ? document.querySelector("#card-" + id + " .title-link").textContent : "" };
    }))`);
    check(addedCards.length === 3 && addedCards.every((card) => card.width > 0 && card.advice.includes("建议，非已落地") && card.title.length > 0), "new cases render a decoded still and the suggestion marker " + JSON.stringify(addedCards));
    const teasers = await evaluate(cdp, sessionId, "Object.fromEntries([...document.querySelectorAll('article.card')].map((card) => [card.getAttribute('data-case-id'), card.querySelector('.advice-teaser') ? card.querySelector('.advice-teaser').textContent : '']))");
    for (const id of ORIGINALS) {
      const opening = ADVICE[id].split("。")[0];
      check(teasers[id] && teasers[id].includes("建议，非已落地") && teasers[id].includes(opening), "card teaser keeps the suggestion opening for " + id);
    }
    const gaps = await evaluate(cdp, sessionId, `["ip-bluemoon-jingjing-2026","ip-jingpai-jiuling-2026","ip-coke-fanzhiyi-2026"].map((id) => {
      const shot = document.querySelector("#card-" + id + " .shot");
      return { id, linkOnly: shot.classList.contains("is-link-only"), failed: shot.classList.contains("is-failed"), imgs: shot.querySelectorAll("img").length, text: shot.innerText, hrefs: Array.from(shot.querySelectorAll("a")).map((node) => node.getAttribute("href")) };
    })`);
    for (const gap of gaps) {
      check(gap.linkOnly === true && gap.failed === true && gap.imgs === 0 && gap.text.includes("此例没有入库图片") && !gap.text.includes("图片未能显示") && gap.hrefs.some((href) => href && href.startsWith("http")), "link-only card keeps source links for " + gap.id + " " + JSON.stringify(gap));
    }
    await shot(cdp, sessionId, "/opt/cursor/artifacts/public-list-360.png");

    await evaluate(cdp, sessionId, "document.getElementById('filter-toggle').click()");
    const opened = await evaluate(cdp, sessionId, "({hidden: document.getElementById('filters').hidden, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth})");
    check(opened.hidden === false && opened.overflow <= 1, "opened filters stay inside 360");
    await evaluate(cdp, sessionId, "document.querySelector('[data-filter-group=\"category\"] button[data-value=\"ip\"]').click()");
    const ipOnly = await evaluate(cdp, sessionId, "Array.from(document.querySelectorAll('article.card')).filter((node) => !node.hidden).map((node) => node.getAttribute('data-case-id')).sort()");
    check(ipOnly.length === 10, "category filter shows the IP cases");
    await evaluate(cdp, sessionId, "document.getElementById('reset-filters').click()");

    await evaluate(cdp, sessionId, "document.querySelector('#card-ip-tmall-fuli-2026 button[data-status=\"入选\"]').click(); document.querySelector('#card-brand-unilever-packaging-2026 button[data-status=\"入选\"]').click(); document.querySelector('#card-image-loreal-cisce-2026 button[data-status=\"候补\"]').click(); document.querySelector('#card-ip-coke-holidays-2025 button[data-status=\"暂不考虑\"]').click();");
    const after = await evaluate(cdp, sessionId, "Object.fromEntries(Array.from(document.querySelectorAll('[data-count-for]')).map((node) => [node.getAttribute('data-count-for'), node.textContent]))");
    check(after["入选"] === "2" && after["候补"] === "1" && after["暂不考虑"] === "1" && after["未处理"] === "19", "status counts follow the four choices");
    await evaluate(cdp, sessionId, "document.querySelector('[data-filter-group=\"status\"] button[data-value=\"入选\"]').click()");
    const picked = await evaluate(cdp, sessionId, "Array.from(document.querySelectorAll('article.card')).filter((node) => !node.hidden).map((node) => node.getAttribute('data-case-id')).sort()");
    check(JSON.stringify(picked) === JSON.stringify(["brand-unilever-packaging-2026", "ip-tmall-fuli-2026"]), "入选 filter shows the two selected cases");
    await evaluate(cdp, sessionId, "document.querySelector('[data-filter-group=\"status\"] button[data-value=\"all\"]').click()");
    await evaluate(cdp, sessionId, "document.getElementById('q').value = 'zzzz-no-match'; document.getElementById('q').dispatchEvent(new Event('input', { bubbles: true }))");
    const empty = await evaluate(cdp, sessionId, "document.getElementById('empty').hidden === false && !!document.getElementById('empty-reset')");
    check(empty === true, "empty search offers a reset");
    await evaluate(cdp, sessionId, "document.getElementById('empty-reset').click()");
    const restored = await evaluate(cdp, sessionId, "({shown: Array.from(document.querySelectorAll('article.card')).filter((node) => !node.hidden).length, status: document.querySelector('#card-ip-tmall-fuli-2026 .stamp[aria-pressed=\"true\"]').getAttribute('data-status'), query: document.getElementById('q').value})");
    check(restored.shown === 23 && restored.status === "入选" && restored.query === "", "reset clears the search and keeps the shortlist " + JSON.stringify(restored));

    await evaluate(cdp, sessionId, "document.getElementById('calibration-open').click()");
    await waitFor(cdp, sessionId, "document.getElementById('calibration-dialog').open && document.querySelectorAll('#cal-content input[type=\"checkbox\"]').length > 0");
    const calStart = await evaluate(cdp, sessionId, "({progress: document.getElementById('cal-progress').textContent, backDisabled: document.getElementById('cal-back').disabled, boxes: document.querySelectorAll('#cal-content input[type=\"checkbox\"]').length})");
    check(calStart.progress.includes("第 1 题") && calStart.backDisabled === true && calStart.boxes === 4, "calibration opens on question one");
    await evaluate(cdp, sessionId, "document.querySelector('#cal-content input[data-question=\"goals\"][data-option=\"ip-vivid\"]').click(); document.querySelector('#cal-content input[data-question=\"goals\"][data-option=\"capability-trust\"]').click();");
    await evaluate(cdp, sessionId, "document.getElementById('cal-next').click()");
    await waitFor(cdp, sessionId, "document.getElementById('cal-progress').textContent.includes('第 2 题')");
    await evaluate(cdp, sessionId, "document.querySelector('#cal-content input[data-question=\"ip-experience\"][data-option=\"respond-memory\"]').click()");
    await evaluate(cdp, sessionId, "document.getElementById('cal-back').click()");
    await waitFor(cdp, sessionId, "document.getElementById('cal-progress').textContent.includes('第 1 题')");
    const calBack = await evaluate(cdp, sessionId, "Array.from(document.querySelectorAll('#cal-content input[data-question=\"goals\"]')).filter((node) => node.checked).map((node) => node.getAttribute('data-option')).sort()");
    check(JSON.stringify(calBack) === JSON.stringify(["capability-trust", "ip-vivid"]), "back navigation keeps multi-select choices");
    await evaluate(cdp, sessionId, "document.getElementById('cal-next').click()");
    await waitFor(cdp, sessionId, "document.getElementById('cal-progress').textContent.includes('第 2 题')");
    await evaluate(cdp, sessionId, "document.getElementById('cal-next').click()");
    await waitFor(cdp, sessionId, "document.getElementById('cal-progress').textContent.includes('第 3 题')");
    await evaluate(cdp, sessionId, "document.querySelector('#cal-content input[data-question=\"exclude-forms\"][data-option=\"exclude-none\"]').click()");
    await evaluate(cdp, sessionId, "document.querySelector('#cal-content input[data-question=\"exclude-forms\"][data-option=\"exclude-short-film\"]').click()");
    const calExclusive = await evaluate(cdp, sessionId, "Array.from(document.querySelectorAll('#cal-content input[data-question=\"exclude-forms\"]')).filter((node) => node.checked).map((node) => node.getAttribute('data-option'))");
    check(JSON.stringify(calExclusive) === JSON.stringify(["exclude-short-film"]), "exclusive none is cleared once another exclusion is chosen");
    await evaluate(cdp, sessionId, "document.getElementById('cal-next').click()");
    await waitFor(cdp, sessionId, "document.getElementById('cal-progress').textContent.includes('复核摘要')");
    const calReview = await evaluate(cdp, sessionId, "({skipHidden: document.getElementById('cal-skip').hidden, rows: document.querySelectorAll('.cal-review-item').length, text: document.getElementById('cal-content').innerText})");
    check(calReview.skipHidden === true && calReview.rows === 3 && calReview.text.includes("编辑本题"), "review page is editable");
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 900, deviceScaleFactor: 1, mobile: true }, sessionId);
    await shot(cdp, sessionId, "/opt/cursor/artifacts/public-quiz-390.png");
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 360, height: 900, deviceScaleFactor: 1, mobile: true }, sessionId);
    await evaluate(cdp, sessionId, "document.querySelector('[data-edit-calibration=\"2\"]').click()");
    await waitFor(cdp, sessionId, "document.getElementById('cal-progress').textContent.includes('第 3 题')");
    await evaluate(cdp, sessionId, "document.querySelector('#cal-content input[data-question=\"exclude-forms\"][data-option=\"exclude-none\"]').click()");
    const calNone = await evaluate(cdp, sessionId, "Array.from(document.querySelectorAll('#cal-content input[data-question=\"exclude-forms\"]')).filter((node) => node.checked).map((node) => node.getAttribute('data-option'))");
    check(JSON.stringify(calNone) === JSON.stringify(["exclude-none"]), "exclude-none is exclusive when selected");
    await evaluate(cdp, sessionId, "document.getElementById('cal-skip').click()");
    await waitFor(cdp, sessionId, "document.getElementById('cal-progress').textContent.includes('复核摘要')");
    await evaluate(cdp, sessionId, "document.getElementById('cal-close').click()");
    const calSummary = await evaluate(cdp, sessionId, "({summary: document.getElementById('calibration-summary').textContent, dialogOpen: document.getElementById('calibration-dialog').open, status: document.querySelector('#card-ip-tmall-fuli-2026 .stamp[aria-pressed=\"true\"]').getAttribute('data-status')})");
    check(calSummary.dialogOpen === false && calSummary.summary.includes("已填写") && calSummary.summary.includes("Q1") && calSummary.status === "入选", "closing calibration keeps shortlist untouched and writes summary");
    await evaluate(cdp, sessionId, "location.reload()");
    await waitFor(cdp, sessionId, "document.querySelectorAll('article.card').length === 23 && document.getElementById('calibration-summary')");
    const calReload = await evaluate(cdp, sessionId, "({summary: document.getElementById('calibration-summary').textContent, status: document.querySelector('#card-ip-tmall-fuli-2026 .stamp[aria-pressed=\"true\"]').getAttribute('data-status'), keys: Object.keys(localStorage).sort()})");
    check(calReload.summary.includes("已填写") && calReload.status === "入选" && calReload.keys.includes("ai-brand-case-selection-v1") && calReload.keys.includes("ai-brand-case-calibration-v1"), "calibration persists independently from shortlist state");

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
    check(JSON.stringify(detail.sections) === JSON.stringify(["AI机制", "前沿性", "规模证据", "对标价值", "受众与触点", "来源与局限", "对标建议"]), "evidence sections follow the reading order");
    check(detail.scale === "规模未核实" && detail.frontier.includes("未单列"), "scale and frontier stay honest");
    check(detail.pressed === "入选" && detail.source === true && detail.note.includes("这台浏览器"), "shortlist and sources stay on the detail");
    check(detail.overflow <= 1, "detail does not overflow at 360");
    for (const id of ORIGINALS) {
      await evaluate(cdp, sessionId, "location.hash = " + JSON.stringify("case-" + id));
      await waitFor(cdp, sessionId, "document.querySelector('#reader .advice') && document.getElementById('reader-title')");
      const shown = await evaluate(cdp, sessionId, "document.querySelector('#reader .advice').textContent");
      check(shown.includes("对标建议") && shown.includes("建议，非已落地") && shown.includes(ADVICE[id]), "detail shows the suggestion copy for " + id);
    }
    await evaluate(cdp, sessionId, "location.hash = '#case-image-kerastase-kscan-2026'");
    await waitFor(cdp, sessionId, "document.querySelector('#reader .advice') && document.getElementById('reader-title') && document.getElementById('reader-title').textContent.includes('K-SCAN')");
    const keraShown = await evaluate(cdp, sessionId, `({
      caption: document.querySelector('#reader .detail-caption').textContent,
      text: document.getElementById('reader').innerText,
      picture: document.querySelector('#reader img') ? document.querySelector('#reader img').naturalWidth : 0,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    })`);
    check(keraShown.caption.includes("不是诊断结果界面") && keraShown.text.includes("不是普通生成图") && keraShown.text.includes("公司陈述，未独立核验") && keraShown.text.includes("9,000") && keraShown.text.includes("12,000") && keraShown.text.includes("对标建议") && keraShown.text.includes("建议，非已落地"), "kerastase detail keeps the supplied guards");
    check(keraShown.picture > 0 && keraShown.overflow <= 1, "kerastase still loads inside the narrow detail");
    await evaluate(cdp, sessionId, "location.hash = '#case-ip-coke-fanzhiyi-2026'");
    await waitFor(cdp, sessionId, "document.getElementById('reader-title') && document.getElementById('reader-title').textContent.includes('范志毅') && document.querySelector('#reader details')");
    const fanShown = await evaluate(cdp, sessionId, `({
      imgs: document.querySelectorAll('#reader img').length,
      shot: document.getElementById('reader-shot').innerText,
      open: document.querySelector('#reader details').open,
      summary: document.querySelector('#reader details summary').textContent,
      links: Array.from(document.querySelectorAll('#reader a')).filter((node) => node.href && node.href.startsWith('http')).length,
      text: document.getElementById('reader').innerText,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    })`);
    check(fanShown.imgs === 0 && fanShown.shot.includes("此例没有入库图片") && !fanShown.shot.includes("图片未能显示") && fanShown.open === true && fanShown.summary === "可打开的来源" && fanShown.links >= 2 && fanShown.text.includes("建议，非已落地") && fanShown.overflow <= 1, "link-only detail stays usable " + JSON.stringify(fanShown));
    await evaluate(cdp, sessionId, "window.scrollTo(0, 0)");
    await shot(cdp, sessionId, "/opt/cursor/artifacts/public-detail-linkonly-360.png");

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
    await shot(cdp, sessionId, "/opt/cursor/artifacts/public-list-390.png");

    await evaluate(cdp, sessionId, "document.querySelector('#card-ip-coke-holidays-2025 img').src = 'assets/missing-file.jpg'");
    await new Promise((resolve) => setTimeout(resolve, 400));
    const failed = await evaluate(cdp, sessionId, "({failed: document.querySelector('#card-ip-coke-holidays-2025 .shot').classList.contains('is-failed'), text: document.querySelector('#card-ip-coke-holidays-2025 .shot').innerText, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth})");
    check(failed.failed === true && failed.text.includes("图片未能显示") && failed.overflow <= 1, "a failed image keeps its frame and link");

    await evaluate(cdp, sessionId, "localStorage.setItem('ai-brand-case-selection-v1', JSON.stringify({'image-loreal-cisce-2026':'候补'})); location.href = location.pathname;");
    await waitFor(cdp, sessionId, "document.querySelectorAll('article.card').length === 23 && document.querySelector('#card-image-loreal-cisce-2026 button[aria-pressed=\"true\"]')");
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
    await evaluate(cdp, sessionId, "document.getElementById('calibration-export').click()");
    const calImportFile = path.join(os.tmpdir(), "selector-calibration-import.json");
    fs.writeFileSync(calImportFile, JSON.stringify({
      schema: "ai-brand-case-calibration/v1",
      updated_at: "2026-11-22T07:00:00.000Z",
      answers: { goals: ["brand-consistent"], "exclude-forms": ["exclude-short-film", "exclude-prompt-tool"] }
    }));
    const calNode = await cdp.send("DOM.querySelector", { nodeId: docNode.root.nodeId, selector: "#calibration-import-file" }, sessionId);
    await cdp.send("DOM.setFileInputFiles", { files: [calImportFile], nodeId: calNode.nodeId }, sessionId);
    await new Promise((resolve) => setTimeout(resolve, 300));
    const calImportedUi = await evaluate(cdp, sessionId, "({summary: document.getElementById('calibration-summary').textContent, status: document.querySelector('#card-image-loreal-cisce-2026 button[aria-pressed=\"true\"]').getAttribute('data-status')})");
    check(calImportedUi.summary.includes("brand") || calImportedUi.summary.includes("品牌"), "calibration import updates local summary");
    check(calImportedUi.status === "入选", "calibration import does not alter shortlist statuses");

    await openAt(cdp, sessionId, origin + "/", 1440);
    const wide = await evaluate(cdp, sessionId, "({width: window.innerWidth, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, filters: document.getElementById('filters').hidden, resources: performance.getEntriesByType('resource').map((entry) => entry.name)})");
    check(wide.width === 1440 && wide.overflow <= 1 && wide.filters === false, "desktop shows filters without horizontal overflow");
    check(wide.resources.every((name) => name.startsWith(origin)), "page only loads same-origin files");
    const pageText = await evaluate(cdp, sessionId, "document.body.innerText");
    for (const phrase of PHRASES) {
      if (hasPrivatePhrase(pageText, phrase)) failures.push("rendered page contains a private phrase");
    }
    await shot(cdp, sessionId, "/opt/cursor/artifacts/public-list-1440.png");
    await cdp.send("Page.navigate", { url: origin + "/#case-image-sephora-chatgpt-2026" }, sessionId);
    await waitFor(cdp, sessionId, "document.getElementById('reader-title') && document.getElementById('reader-title').textContent.includes('Sephora')");
    await evaluate(cdp, sessionId, "window.scrollTo(0, 0)");
    await shot(cdp, sessionId, "/opt/cursor/artifacts/public-detail-1440.png");
    await cdp.send("Page.navigate", { url: origin + "/#case-ip-jingpai-jiuling-2026" }, sessionId);
    await waitFor(cdp, sessionId, "document.getElementById('reader-title') && document.querySelector('#reader .shot.is-link-only')");
    await evaluate(cdp, sessionId, "window.scrollTo(0, 0)");
    await shot(cdp, sessionId, "/opt/cursor/artifacts/public-detail-linkonly-1440.png");
  } finally {
    cdp.close();
    chrome.proc.kill("SIGKILL");
    try { fs.rmSync(userDir, { recursive: true, force: true }); } catch (err) { /* the browser may still be releasing its profile */ }
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
  check(fs.existsSync(path.join(out, "assets/fonts/source-serif-4-latin-600.woff2")), "bundle keeps the self-hosted latin face");
  for (const phrase of PHRASES) {
    if (hasPrivatePhrase(html, phrase)) failures.push("public bundle contains a private phrase");
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
    await waitFor(cdp, sessionId, "document.querySelectorAll('article.card').length === 23 && document.getElementById('loading').hidden");
    const offline = await evaluate(cdp, sessionId, "document.getElementById('error') ? document.getElementById('error').textContent : ''");
    check(offline === "", "bundled file opens without fetching evidence.json");
  } finally {
    cdp.close();
    chrome.proc.kill("SIGKILL");
    try { fs.rmSync(userDir, { recursive: true, force: true }); } catch (err) { /* the browser may still be releasing its profile */ }
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
