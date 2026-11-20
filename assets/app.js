(function (root, factory) {
  var api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CaseSelection = api;
  if (typeof document !== "undefined") {
    var start = function () { api.mount(document); };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
    else start();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  var STATUSES = ["未处理", "入选", "候补", "暂不考虑"];
  var KEY = "ai-brand-case-selection-v1";
  var SCHEMA = "ai-brand-case-selection/v1";

  function inWindow(iso, win) {
    if (!win || win === "all") return true;
    if (!iso) return false;
    if (win === "6m") return iso >= "2026-05-19";
    if (win === "12m") return iso >= "2025-11-19";
    if (win === "earlier") return iso < "2025-11-19";
    return true;
  }

  function normalize(s) {
    return String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function statusOf(map, id) {
    var value = map && map[id];
    return STATUSES.indexOf(value) >= 0 ? value : "未处理";
  }

  function primarySource(item) {
    var list = (item && item.sources) || [];
    var i;
    for (i = 0; i < list.length; i += 1) {
      if (list[i] && String(list[i].label || "").indexOf("主来源") !== -1 && list[i].url) return list[i];
    }
    return list[0] || { label: "主来源", url: "" };
  }

  function haystack(item) {
    var bits = [item.title, item.brand, item.summary, item.id, (item.tags || []).join(" ")];
    (item.evidence || []).forEach(function (line) { bits.push(line); });
    bits.push(item.limits || "");
    return bits.join(" ");
  }

  function matchCase(item, filters) {
    filters = filters || {};
    if (filters.category && filters.category !== "all" && item.category !== filters.category) return false;
    if (filters.status && filters.status !== "all" && (item.status || "未处理") !== filters.status) return false;
    if (!inWindow(item.date_iso || item.dateISO, filters.window || "all")) return false;
    if (filters.query) {
      var hay = normalize(item.hay != null ? item.hay : haystack(item));
      if (hay.indexOf(normalize(filters.query)) === -1) return false;
    }
    return true;
  }

  function safeHttpUrl(url) {
    if (typeof url !== "string") return "";
    var t = url.trim();
    if (!/^https?:\/\//i.test(t)) return "";
    if (/[\u0000-\u001f\s]/.test(t)) return "";
    return t;
  }

  function safeAsset(path) {
    if (typeof path !== "string") return "";
    if (!/^assets\/[A-Za-z0-9._-]+$/.test(path)) return "";
    return path;
  }

  function blankMap() {
    return Object.create(null);
  }

  function loadMap(storage, knownIds) {
    var result = { map: blankMap(), error: false };
    var known = blankMap();
    (knownIds || []).forEach(function (id) { known[id] = true; });
    try {
      if (!storage || typeof storage.getItem !== "function") return result;
      var raw = storage.getItem(KEY);
      if (raw == null || raw === "") return result;
      var data = JSON.parse(raw);
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        result.error = true;
        return result;
      }
      Object.keys(data).forEach(function (id) {
        if (!known[id]) return;
        if (STATUSES.indexOf(data[id]) < 0) return;
        result.map[id] = data[id];
      });
    } catch (err) {
      result.error = true;
    }
    return result;
  }

  function saveMap(storage, map) {
    try {
      var plain = {};
      Object.keys(map || {}).forEach(function (id) {
        if (STATUSES.indexOf(map[id]) >= 0) plain[id] = map[id];
      });
      storage.setItem(KEY, JSON.stringify(plain));
      return true;
    } catch (err) {
      return false;
    }
  }

  function validateImport(text, knownIds) {
    if (typeof text !== "string") return { ok: false, selections: [], errors: ["文件不是文本"], skipped: 0 };
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    if (text.length > 200000) return { ok: false, selections: [], errors: ["文件过大"], skipped: 0 };
    var data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      return { ok: false, selections: [], errors: ["不是合法的 JSON"], skipped: 0 };
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return { ok: false, selections: [], errors: ["JSON 须为对象"], skipped: 0 };
    }
    if (data.schema != null && data.schema !== SCHEMA) {
      return { ok: false, selections: [], errors: ["无法识别的文件格式"], skipped: 0 };
    }
    if (!Array.isArray(data.selections)) {
      return { ok: false, selections: [], errors: ["缺少 selections 数组"], skipped: 0 };
    }
    if (data.selections.length > 50) {
      return { ok: false, selections: [], errors: ["selections 过多"], skipped: 0 };
    }
    var known = blankMap();
    (knownIds || []).forEach(function (id) { known[id] = true; });
    var out = [];
    var skipped = 0;
    data.selections.forEach(function (row) {
      if (!row || typeof row !== "object" || Array.isArray(row)) { skipped += 1; return; }
      if (typeof row.id !== "string" || !known[row.id]) { skipped += 1; return; }
      if (STATUSES.indexOf(row.status) < 0) { skipped += 1; return; }
      out.push({ id: row.id, status: row.status });
    });
    if (!out.length) return { ok: false, selections: [], errors: ["没有可导入的有效挑选"], skipped: skipped };
    return { ok: true, selections: out, errors: [], skipped: skipped };
  }

  function csvCell(value) {
    var s = String(value == null ? "" : value).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    return '"' + s.replace(/"/g, '""') + '"';
  }

  function toCsv(rows) {
    var lines = [ ["标题", "类别", "状态", "原始来源"].map(csvCell).join(",") ];
    (rows || []).forEach(function (row) {
      lines.push([row.title, row.category, row.status, row.source].map(csvCell).join(","));
    });
    return "\uFEFF" + lines.join("\r\n") + "\r\n";
  }

  function toExport(cases, map) {
    return {
      schema: SCHEMA,
      verifiedOn: "2026-11-19",
      note: "本浏览器保存，不跨设备同步。状态是浏览者的挑选，不代表案例已被批准。",
      selections: cases.map(function (item) {
        var source = primarySource(item);
        return {
          id: item.id,
          title: item.title,
          category: item.category_label,
          status: statusOf(map, item.id),
          source: source.url || ""
        };
      })
    };
  }

  function el(doc, tag, attrs, text) {
    var node = doc.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        if (key === "hidden") node.hidden = !!attrs[key];
        else node.setAttribute(key, attrs[key]);
      });
    }
    if (text != null) node.textContent = text;
    return node;
  }

  function link(doc, url, label) {
    var safe = safeHttpUrl(url);
    if (!safe) return el(doc, "span", null, label || "链接不可用");
    var a = el(doc, "a", { href: safe, target: "_blank", rel: "noopener noreferrer" }, label || safe);
    return a;
  }

  function addParagraphs(doc, parent, text) {
    String(text || "").split(/\n+/).forEach(function (part) {
      if (!part.trim()) return;
      parent.appendChild(el(doc, "p", null, part.trim()));
    });
  }

  function mount(doc) {
    var loading = doc.getElementById("loading");
    var errorBox = doc.getElementById("error");
    var list = doc.getElementById("list");
    var empty = doc.getElementById("empty");
    var countEl = doc.getElementById("count");
    var warn = doc.getElementById("save-warn");
    var ioMsg = doc.getElementById("io-msg");
    var state = { cases: [], map: blankMap(), filters: { category: "all", window: "all", status: "all", query: "" } };

    function showError(message) {
      if (loading) loading.hidden = true;
      if (errorBox) {
        errorBox.hidden = false;
        errorBox.textContent = message;
      }
    }

    function readFilters() {
      function on(group, fallback) {
        var pressed = doc.querySelector('[data-filter-group="' + group + '"] button[aria-pressed="true"]');
        return pressed ? pressed.getAttribute("data-value") : fallback;
      }
      state.filters.category = on("category", "all");
      state.filters.window = on("window", "all");
      state.filters.status = on("status", "all");
      var q = doc.getElementById("q");
      state.filters.query = q ? q.value : "";
    }

    function pool() {
      return state.cases.filter(function (item) {
        return matchCase({
          category: item.category,
          date_iso: item.date_iso,
          status: "未处理",
          hay: haystack(item)
        }, {
          category: state.filters.category,
          window: state.filters.window,
          status: "all",
          query: state.filters.query
        });
      });
    }

    function refreshCounts(visible) {
      var base = pool();
      var tally = { "未处理": 0, "入选": 0, "候补": 0, "暂不考虑": 0 };
      base.forEach(function (item) { tally[statusOf(state.map, item.id)] += 1; });
      STATUSES.forEach(function (name) {
        var slot = doc.querySelector('[data-count-for="' + name + '"]');
        if (slot) slot.textContent = String(tally[name]);
      });
      if (countEl) countEl.textContent = "显示 " + visible + " / " + state.cases.length;
    }

    function apply() {
      readFilters();
      var visible = 0;
      state.cases.forEach(function (item) {
        var card = doc.getElementById(item.id);
        if (!card) return;
        var show = matchCase({
          category: item.category,
          date_iso: item.date_iso,
          status: statusOf(state.map, item.id),
          hay: haystack(item)
        }, state.filters);
        card.hidden = !show;
        if (show) visible += 1;
        card.querySelectorAll(".stamp").forEach(function (btn) {
          var on = btn.getAttribute("data-status") === statusOf(state.map, item.id);
          btn.setAttribute("aria-pressed", on ? "true" : "false");
        });
      });
      if (empty) empty.hidden = visible !== 0;
      refreshCounts(visible);
    }

    function persist() {
      var ok = saveMap(root.localStorage, state.map);
      if (warn) warn.hidden = ok;
      return ok;
    }

    function setGroup(group, value) {
      doc.querySelectorAll('[data-filter-group="' + group + '"] button').forEach(function (btn) {
        btn.setAttribute("aria-pressed", btn.getAttribute("data-value") === value ? "true" : "false");
      });
      apply();
    }

    function renderCase(item) {
      var article = el(doc, "article", {
        class: "case",
        id: item.id,
        "data-category": item.category,
        "data-date": item.date_iso
      });
      var meta = el(doc, "p", { class: "meta" });
      meta.appendChild(el(doc, "span", { class: "cat" }, item.category_label));
      meta.appendChild(el(doc, "span", null, item.date_label || item.date_iso));
      meta.appendChild(el(doc, "span", null, "置信 " + (item.confidence_label || "")));
      article.appendChild(meta);
      article.appendChild(el(doc, "h2", null, item.title));

      var figure = el(doc, "figure", { class: "shot" });
      var media = (item.media || [])[0];
      var source = primarySource(item);
      if (media && safeAsset(media.file)) {
        var img = el(doc, "img", { src: safeAsset(media.file), alt: String(media.caption || item.title).split("。")[0] });
        img.addEventListener("error", function () {
          var box = el(doc, "div", { class: "shot-fallback" });
          box.appendChild(el(doc, "p", null, "图片未能显示"));
          if (media.original) box.appendChild(link(doc, media.original, "打开原始图片来源"));
          img.replaceWith(box);
        });
        figure.appendChild(img);
        if (media.caption) figure.appendChild(el(doc, "figcaption", null, media.caption));
      } else {
        var fallback = el(doc, "div", { class: "shot-fallback" });
        fallback.appendChild(el(doc, "p", null, "此例没有入库图片"));
        fallback.appendChild(link(doc, source.url, "打开主来源"));
        figure.appendChild(fallback);
      }
      article.appendChild(figure);

      var primary = el(doc, "p", { class: "primary" });
      primary.appendChild(el(doc, "b", null, "主来源 · " + (source.label || "")));
      primary.appendChild(link(doc, source.url, source.url));
      if (source.status) primary.appendChild(el(doc, "span", { class: "hint" }, source.status));
      article.appendChild(primary);
      if (item.summary) article.appendChild(el(doc, "p", { class: "summary" }, item.summary));

      var stamps = el(doc, "div", { class: "stamps", role: "group", "aria-label": item.title + " 的挑选状态" });
      STATUSES.forEach(function (name) {
        var btn = el(doc, "button", { type: "button", class: "stamp", "data-status": name, "aria-pressed": name === "未处理" ? "true" : "false" }, name);
        btn.addEventListener("click", function () {
          if (name === "未处理") delete state.map[item.id];
          else state.map[item.id] = name;
          persist();
          apply();
        });
        stamps.appendChild(btn);
      });
      article.appendChild(stamps);

      var details = el(doc, "details");
      details.appendChild(el(doc, "summary", null, "展开证据、局限与其余来源"));
      var body = el(doc, "div", { class: "detail" });
      function block(title, node) {
        body.appendChild(el(doc, "h3", null, title));
        body.appendChild(node);
      }
      if (item.window_note) block("时间位置", el(doc, "p", null, item.window_note));
      if (item.ai_where) block("用在何处", el(doc, "p", null, item.ai_where));
      if (item.evidence && item.evidence.length) {
        var ul = el(doc, "ul");
        item.evidence.forEach(function (line) { ul.appendChild(el(doc, "li", null, line)); });
        block("证据", ul);
      }
      if ((item.media || []).length > 1) {
        var gallery = el(doc, "div");
        item.media.slice(1).forEach(function (shot) {
          var fig = el(doc, "figure", { class: "shot" });
          if (safeAsset(shot.file)) {
            var extra = el(doc, "img", { src: safeAsset(shot.file), alt: String(shot.caption || item.title).split("。")[0] });
            extra.addEventListener("error", function () {
              var box = el(doc, "div", { class: "shot-fallback" });
              box.appendChild(el(doc, "p", null, "图片未能显示"));
              if (shot.original) box.appendChild(link(doc, shot.original, "打开原始图片来源"));
              extra.replaceWith(box);
            });
            fig.appendChild(extra);
          }
          if (shot.caption) fig.appendChild(el(doc, "figcaption", null, shot.caption));
          gallery.appendChild(fig);
        });
        block("其余图片", gallery);
      }
      if (item.limits) block("局限", el(doc, "p", null, item.limits));
      if (item.benchmark) block("对标", el(doc, "p", null, item.benchmark));
      if (item.audience) block("受众与触点", el(doc, "p", null, item.audience));
      if (item.heat) block("热度", el(doc, "p", null, item.heat));
      var sources = el(doc, "ul", { class: "src-list" });
      (item.sources || []).forEach(function (src) {
        var li = el(doc, "li");
        li.appendChild(link(doc, src.url, (src.label || "来源") + " · " + (src.url || "")));
        if (src.status) li.appendChild(el(doc, "div", { class: "hint" }, src.status));
        sources.appendChild(li);
      });
      block("全部来源", sources);
      if (item.remote_only && item.remote_only.length) {
        var remote = el(doc, "ul");
        item.remote_only.forEach(function (src) {
          var li = el(doc, "li");
          li.appendChild(link(doc, src.url, (src.label || "原链") + " · " + (src.url || "")));
          remote.appendChild(li);
        });
        block("未能入库的原链", remote);
      }
      details.appendChild(body);
      article.appendChild(details);
      return article;
    }

    function renderAppendix(data) {
      var section = doc.getElementById("limits");
      var holder = doc.getElementById("lim-list");
      if (!section || !holder) return;
      if (data.scope_note) holder.appendChild(el(doc, "p", null, data.scope_note));
      (data.appendix || []).forEach(function (item) {
        var box = el(doc, "article", { class: "limit" });
        box.appendChild(el(doc, "h3", null, item.heading));
        addParagraphs(doc, box, item.body);
        holder.appendChild(box);
      });
      section.hidden = false;
    }

    function wire() {
      doc.querySelectorAll("[data-filter-group]").forEach(function (group) {
        group.addEventListener("click", function (event) {
          var btn = event.target.closest("button");
          if (!btn || !group.contains(btn)) return;
          setGroup(group.getAttribute("data-filter-group"), btn.getAttribute("data-value"));
        });
      });
      var q = doc.getElementById("q");
      if (q) q.addEventListener("input", apply);

      function download(filename, mime, text) {
        var blob = new Blob([text], { type: mime });
        var a = doc.createElement("a");
        var url = URL.createObjectURL(blob);
        a.href = url;
        a.download = filename;
        a.rel = "noopener";
        doc.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
      }
      var csvBtn = doc.getElementById("export-csv");
      var jsonBtn = doc.getElementById("export-json");
      if (csvBtn) csvBtn.addEventListener("click", function () {
        var rows = toExport(state.cases, state.map).selections;
        download("ai-brand-selection.csv", "text/csv;charset=utf-8", toCsv(rows));
        if (ioMsg) ioMsg.textContent = "已导出 CSV（UTF-8 BOM）。";
      });
      if (jsonBtn) jsonBtn.addEventListener("click", function () {
        download("ai-brand-selection.json", "application/json;charset=utf-8", JSON.stringify(toExport(state.cases, state.map), null, 2));
        if (ioMsg) ioMsg.textContent = "已导出 JSON。";
      });
      var input = doc.getElementById("import-file");
      if (input) input.addEventListener("change", function () {
        var file = input.files && input.files[0];
        input.value = "";
        if (!file) return;
        if (file.size > 200000) {
          if (ioMsg) ioMsg.textContent = "文件过大，未导入。";
          return;
        }
        var reader = new FileReader();
        reader.onerror = function () { if (ioMsg) ioMsg.textContent = "无法读取文件。"; };
        reader.onload = function () {
          var ids = state.cases.map(function (item) { return item.id; });
          var result = validateImport(String(reader.result || ""), ids);
          if (!result.ok) {
            if (ioMsg) ioMsg.textContent = result.errors.join("；");
            return;
          }
          result.selections.forEach(function (row) { state.map[row.id] = row.status; });
          persist();
          apply();
          if (ioMsg) {
            ioMsg.textContent = "已导入 " + result.selections.length + " 条" + (result.skipped ? "，跳过 " + result.skipped + " 条" : "") + "。";
          }
        };
        reader.readAsText(file, "utf-8");
      });

      var dialog = doc.getElementById("clear-dialog");
      var clearBtn = doc.getElementById("clear-btn");
      var cancel = doc.getElementById("clear-cancel");
      var confirmBtn = doc.getElementById("clear-confirm");
      if (clearBtn && dialog) clearBtn.addEventListener("click", function () { dialog.showModal(); });
      if (cancel && dialog) cancel.addEventListener("click", function () { dialog.close(); });
      if (confirmBtn && dialog) confirmBtn.addEventListener("click", function () {
        state.map = blankMap();
        try { root.localStorage.removeItem(KEY); } catch (err) { /* shown below if save also fails */ }
        persist();
        apply();
        dialog.close();
        if (ioMsg) ioMsg.textContent = "已清空挑选，六例回到未处理。";
      });
    }

    wire();
    fetch("evidence.json", { cache: "no-store" }).then(function (res) {
      if (!res.ok) throw new Error("status " + res.status);
      return res.json();
    }).then(function (data) {
      if (!data || !Array.isArray(data.cases) || data.cases.length !== 6) {
        showError("案例数据不完整。请确认 evidence.json 与页面在同一目录。");
        return;
      }
      state.cases = data.cases;
      var loaded = loadMap(root.localStorage, data.cases.map(function (item) { return item.id; }));
      state.map = loaded.map;
      if (loaded.error && warn) {
        warn.hidden = false;
        warn.textContent = "本浏览器里的挑选记录无法读取，已按未处理显示。";
      }
      data.cases.forEach(function (item) { list.appendChild(renderCase(item)); });
      renderAppendix(data);
      if (loading) loading.hidden = true;
      apply();
    }).catch(function (err) {
      showError("案例数据没有载入。请用静态服务器打开本页，并确认 evidence.json 与 index.html 在同一目录。");
      if (typeof console !== "undefined") console.error(err);
    });
  }

  return {
    STATUSES: STATUSES,
    KEY: KEY,
    SCHEMA: SCHEMA,
    inWindow: inWindow,
    matchCase: matchCase,
    statusOf: statusOf,
    primarySource: primarySource,
    validateImport: validateImport,
    toCsv: toCsv,
    toExport: toExport,
    loadMap: loadMap,
    saveMap: saveMap,
    safeHttpUrl: safeHttpUrl,
    safeAsset: safeAsset,
    mount: mount
  };
});
