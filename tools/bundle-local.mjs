import fs from "node:fs";
import path from "node:path";

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1 || !process.argv[index + 1]) return fallback;
  return process.argv[index + 1];
}

const dataPath = arg("--data", "");
const assetsDir = arg("--assets", "");
const jsPath = arg("--js", "");
const cssPath = arg("--css", "");
const outDir = arg("--out", "");
const templatePath = arg("--template", "");
const extendPath = arg("--extend", "");
const standalonePath = arg("--standalone", "");

if (!dataPath || !assetsDir || !jsPath || !cssPath || !outDir || !templatePath) {
  console.error("Usage: node tools/bundle-local.mjs --data evidence.json --assets assets --js assets/app.js --css assets/styles.css --template index.html --out dist [--extend extend.js] [--standalone standalone.html]");
  process.exit(2);
}

const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
fs.mkdirSync(path.join(outDir, "assets"), { recursive: true });
fs.copyFileSync(jsPath, path.join(outDir, "assets", "app.js"));
fs.copyFileSync(cssPath, path.join(outDir, "assets", "styles.css"));
if (extendPath) fs.copyFileSync(extendPath, path.join(outDir, "assets", "extend.js"));

const imageExt = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"]);
for (const name of fs.readdirSync(assetsDir)) {
  if (!imageExt.has(path.extname(name).toLowerCase())) continue;
  fs.copyFileSync(path.join(assetsDir, name), path.join(outDir, "assets", name));
}

function embedJson(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

let html = fs.readFileSync(templatePath, "utf8");
if (data.title) {
  html = html.replace(/<title>[^<]*<\/title>/, "<title>" + escapeHtml(data.title) + "</title>");
  html = html.replace(/<h1 id="book-title">[^<]*<\/h1>/, "<h1 id=\"book-title\">" + escapeHtml(data.title) + "</h1>");
}
const inject = '<script id="casebook-data" type="application/json">' + embedJson(data) + "</script>\n" +
  (extendPath ? '<script src="assets/extend.js"></script>\n' : "");
if (!html.includes('src="assets/app.js"')) throw new Error("template is missing app.js");
html = html.replace('<script src="assets/app.js"></script>', inject + '<script src="assets/app.js"></script>');
fs.writeFileSync(path.join(outDir, "index.html"), html);

const note = [
  "用浏览器打开本目录的 index.html，并保持与 assets 的相对路径。",
  "这是本地文件，不是可以在手机上远程打开的私密网址。",
  standalonePath ? "standalone.html 把样式、脚本和图片嵌在单个文件里，便于单独保存。" : ""
].filter(Boolean).join("\n") + "\n";
fs.writeFileSync(path.join(outDir, "LOCAL.txt"), note);

if (standalonePath) {
  const css = fs.readFileSync(cssPath, "utf8");
  const js = fs.readFileSync(jsPath, "utf8");
  const extend = extendPath ? fs.readFileSync(extendPath, "utf8") : "";
  const cloned = JSON.parse(JSON.stringify(data));
  const mime = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml" };
  const cache = new Map();
  function inlineFile(file) {
    if (!file || cache.has(file)) return cache.get(file) || file;
    const abs = path.join(assetsDir, path.basename(file));
    if (!fs.existsSync(abs)) return file;
    const type = mime[path.extname(abs).toLowerCase()] || "application/octet-stream";
    const uri = "data:" + type + ";base64," + fs.readFileSync(abs).toString("base64");
    cache.set(file, uri);
    return uri;
  }
  for (const item of cloned.cases || []) {
    for (const media of item.media || []) {
      if (media.file) media.file = inlineFile(media.file);
    }
  }
  let single = html
    .replace('<link rel="stylesheet" href="assets/styles.css">', "<style>" + css.replace(/<\/style/gi, "<\\/style") + "</style>")
    .replace(/<script id="casebook-data" type="application\/json">[\s\S]*?<\/script>/, '<script id="casebook-data" type="application/json">' + embedJson(cloned) + "</script>")
    .replace('<script src="assets/extend.js"></script>', extend ? "<script>" + extend.replace(/<\/script/gi, "<\\/script") + "</script>" : "")
    .replace('<script src="assets/app.js"></script>', "<script>" + js.replace(/<\/script/gi, "<\\/script") + "</script>");
  const dest = path.isAbsolute(standalonePath) ? standalonePath : path.join(outDir, standalonePath);
  fs.writeFileSync(dest, single);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, function (ch) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch];
  });
}

console.log(outDir);
