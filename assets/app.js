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
  var SCROLL_KEY = "ai-brand-case-return-v1";
  var PUBLIC_BASIS = { six_months_from: "2026-05-19", twelve_months_from: "2025-11-19" };
  var DEFAULT_LEAD = "已核验的公开案例。先看画面和日期，再读证据，再做挑选。挑选只保存在这台浏览器。";

  function basisOf(data) {
    var time = (data && data.time_basis) || {};
    var six = time.six_months_from || PUBLIC_BASIS.six_months_from;
    var twelve = time.twelve_months_from || PUBLIC_BASIS.twelve_months_from;
    return {
      six_months_from: six,
      twelve_months_from: twelve,
      filter_six_months_from: time.filter_six_months_from || six,
      filter_twelve_months_from: time.filter_twelve_months_from || twelve,
      ninety_days_from: time.ninety_days_from || "",
      verified_on: (data && data.verified_on) || "2026-11-19"
    };
  }

  function inWindow(iso, win, basis) {
    basis = basis || PUBLIC_BASIS;
    var six = basis.filter_six_months_from || basis.six_months_from;
    var twelve = basis.filter_twelve_months_from || basis.twelve_months_from;
    if (!win || win === "all") return true;
    if (!iso) return false;
    if (win === "6m") return iso >= six;
    if (win === "12m") return iso >= twelve;
    if (win === "earlier") return iso < twelve;
    return true;
  }

  function isRecent(iso, basis) {
    basis = basis || PUBLIC_BASIS;
    return !!iso && iso >= basis.six_months_from;
  }

  function isNinety(iso, basis) {
    return !!(basis && basis.ninety_days_from && iso && iso >= basis.ninety_days_from);
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
    var bits = [item.title, item.brand, item.summary, item.id, item.ai_where, item.advice, (item.tags || []).join(" ")];
    (item.evidence || []).forEach(function (line) { bits.push(line); });
    bits.push(item.limits || "");
    return bits.join(" ");
  }

  function matchCase(item, filters, basis) {
    filters = filters || {};
    if (filters.category && filters.category !== "all" && item.category !== filters.category) return false;
    if (filters.status && filters.status !== "all" && (item.status || "未处理") !== filters.status) return false;
    if (filters.round && filters.round !== "all" && item.round !== filters.round) return false;
    if (!inWindow(item.date_iso || item.dateISO, filters.window || "all", basis)) return false;
    if (filters.query) {
      var hay = normalize(item.hay != null ? item.hay : haystack(item));
      if (hay.indexOf(normalize(filters.query)) === -1) return false;
    }
    return true;
  }

  function scaleState(item) {
    var heat = String((item && item.heat) || "").trim();
    var unverified = !heat || /未核实|未另核|不适用|未独立/.test(heat);
    return { recorded: heat, unverified: unverified, label: unverified ? "规模未核实" : "" };
  }

  var EVIDENCE_TYPES = {
    official_company_statement: "公司陈述，未独立核验",
    official_page: "官方页面记录",
    agency_statement: "代理方陈述，未独立核验",
    industry_media: "行业媒体",
    vendor_statement: "供应商陈述，未独立核验",
    independent_verification: "独立核验",
    related_official_not_equated: "相关官方文本，不与本项目等同",
    social_unverified: "社交来源，未核验"
  };

  function evidenceTypeLabel(type) {
    return EVIDENCE_TYPES[type] || "来源记录";
  }

  function frontierState(item) {
    var text = String((item && (item.frontier_mechanism || item.frontier)) || "").trim();
    if (text) return { recorded: true, text: text };
    return { recorded: false, text: "材料未单列可独立核实的前沿性判断。" };
  }

  function preferContain(media) {
    var blob = ((media && media.caption) || "") + " " + ((media && media.file) || "");
    return /主视觉|包装|标志|logo|海报/i.test(blob);
  }

  function sourceVerb(url) {
    return /youtu\.?be|youtube\.com|vimeo\.com|\.mp4(\?|$)/i.test(String(url || "")) ? "打开原片" : "打开来源";
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
    if (path.indexOf("data:image/") === 0 && path.indexOf(",") > 0) return path;
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
      var source = data;
      if (data && typeof data === "object" && !Array.isArray(data) && Array.isArray(data.selections)) {
        source = blankMap();
        data.selections.forEach(function (row) {
          if (row && typeof row.id === "string") source[row.id] = row.status;
        });
      }
      if (!source || typeof source !== "object" || Array.isArray(source)) {
        result.error = true;
        return result;
      }
      Object.keys(source).forEach(function (id) {
        if (!known[id]) return;
        if (STATUSES.indexOf(source[id]) < 0) return;
        result.map[id] = source[id];
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
    try { data = JSON.parse(text); }
    catch (err) { return { ok: false, selections: [], errors: ["不是合法的 JSON"], skipped: 0 }; }
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return { ok: false, selections: [], errors: ["JSON 须为对象"], skipped: 0 };
    }
    if (data.schema != null && data.schema !== SCHEMA) {
      return { ok: false, selections: [], errors: ["无法识别的文件格式"], skipped: 0 };
    }
    if (!Array.isArray(data.selections)) {
      return { ok: false, selections: [], errors: ["缺少 selections 数组"], skipped: 0 };
    }
    if (data.selections.length > 100) {
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
    var lines = [["标题", "类别", "状态", "原始来源"].map(csvCell).join(",")];
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

  function parseCaseHash(hash) {
    var h = String(hash || "");
    if (h.charAt(0) === "#") h = h.slice(1);
    try { h = decodeURIComponent(h); } catch (err) { return ""; }
    if (h.indexOf("case-") !== 0) return "";
    return h.slice(5);
  }

  function readEmbedded(doc) {
    if (root && root.CASEBOOK_DATA && typeof root.CASEBOOK_DATA === "object") return root.CASEBOOK_DATA;
    var node = doc.getElementById("casebook-data");
    if (!node || !node.textContent) return null;
    try { return JSON.parse(node.textContent); } catch (err) { return null; }
  }

  function extensionsOf() {
    var ext = root && root.CASEBOOK_EXTEND;
    if (typeof ext === "function") {
      try { ext = ext(); } catch (err) { ext = null; }
    }
    if (!ext || typeof ext !== "object") return {};
    return ext;
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
    return el(doc, "a", { href: safe, target: "_blank", rel: "noopener noreferrer" }, label || safe);
  }

  function addParagraphs(doc, parent, text) {
    String(text || "").split(/\n+/).forEach(function (part) {
      if (!part.trim()) return;
      parent.appendChild(el(doc, "p", null, part.trim()));
    });
  }

  function mount(doc, options) {
    options = options || {};
    var ext = options.extensions || extensionsOf();
    var loading = doc.getElementById("loading");
    var errorBox = doc.getElementById("error");
    var list = doc.getElementById("list");
    var empty = doc.getElementById("empty");
    var countEl = doc.getElementById("count");
    var warn = doc.getElementById("save-warn");
    var ioMsg = doc.getElementById("io-msg");
    var reader = doc.getElementById("reader");
    var library = doc.getElementById("library-view");
    var filters = doc.getElementById("filters");
    var filterToggle = doc.getElementById("filter-toggle");
    var state = {
      cases: [],
      map: blankMap(),
      basis: PUBLIC_BASIS,
      data: null,
      openId: "",
      filters: { category: "all", window: "all", status: "all", query: "", round: "all" },
      wide: true
    };

    function showError(message) {
      if (loading) loading.hidden = true;
      if (errorBox) {
        errorBox.hidden = false;
        errorBox.textContent = message;
      }
    }

    function setWarn(message, show) {
      if (warn) {
        warn.hidden = !show;
        if (show) warn.textContent = message;
      }
      var readerWarn = doc.getElementById("reader-warn");
      if (!readerWarn) return;
      readerWarn.textContent = show ? message : "挑选保存在这台浏览器，刷新后还在。";
    }

    function readFilters() {
      function on(group, fallback) {
        var pressed = doc.querySelector('[data-filter-group="' + group + '"] button[aria-pressed="true"]');
        return pressed ? pressed.getAttribute("data-value") : fallback;
      }
      state.filters.category = on("category", "all");
      state.filters.window = on("window", "all");
      state.filters.status = on("status", "all");
      state.filters.round = on("round", "all");
      var q = doc.getElementById("q");
      state.filters.query = q ? q.value : "";
    }

    function pool() {
      return state.cases.filter(function (item) {
        return matchCase({
          category: item.category,
          date_iso: item.date_iso,
          round: item.round,
          status: "未处理",
          hay: haystack(item)
        }, {
          category: state.filters.category,
          window: state.filters.window,
          status: "all",
          round: state.filters.round,
          query: state.filters.query
        }, state.basis);
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

    function paintPressed() {
      doc.querySelectorAll(".stamp").forEach(function (btn) {
        var id = btn.getAttribute("data-for");
        var on = btn.getAttribute("data-status") === statusOf(state.map, id);
        btn.setAttribute("aria-pressed", on ? "true" : "false");
      });
    }

    function apply() {
      readFilters();
      var visible = 0;
      state.cases.forEach(function (item) {
        var card = doc.getElementById("card-" + item.id);
        if (!card) return;
        var show = matchCase({
          category: item.category,
          date_iso: item.date_iso,
          round: item.round,
          status: statusOf(state.map, item.id),
          hay: haystack(item)
        }, state.filters, state.basis);
        card.hidden = !show;
        if (show) visible += 1;
      });
      if (empty) {
        empty.hidden = visible !== 0;
        if (!empty.hidden && !empty.querySelector("#empty-reset")) {
          empty.textContent = "";
          empty.appendChild(el(doc, "span", null, "没有符合当前筛选的案例。"));
          var reset = el(doc, "button", { type: "button", id: "empty-reset" }, "重置筛选");
          reset.addEventListener("click", resetFilters);
          empty.appendChild(reset);
        }
      }
      paintPressed();
      refreshCounts(visible);
    }

    function persist() {
      var storage = root.localStorage;
      if (!storage) {
        setWarn("这台浏览器没有可用的本地存储，刷新后挑选会丢失。", true);
        return false;
      }
      var ok = saveMap(storage, state.map);
      setWarn(ok ? "" : "无法写入本浏览器存储，刷新后挑选会丢失。", !ok);
      return ok;
    }

    function setStatus(id, name) {
      if (name === "未处理") delete state.map[id];
      else state.map[id] = name;
      persist();
      apply();
    }

    function setGroup(group, value) {
      doc.querySelectorAll('[data-filter-group="' + group + '"] button').forEach(function (btn) {
        btn.setAttribute("aria-pressed", btn.getAttribute("data-value") === value ? "true" : "false");
      });
      apply();
    }

    function resetFilters() {
      ["category", "window", "status", "round"].forEach(function (group) { setGroup(group, "all"); });
      var q = doc.getElementById("q");
      if (q) q.value = "";
      apply();
    }

    function rememberReturn(id) {
      try { root.sessionStorage.setItem(SCROLL_KEY, id); } catch (err) { /* scroll still uses the hash */ }
    }

    function stampBar(id) {
      var box = el(doc, "div", { class: "stamps", role: "group", "aria-label": "挑选状态" });
      STATUSES.forEach(function (name) {
        var btn = el(doc, "button", {
          type: "button",
          class: "stamp",
          "data-status": name,
          "data-for": id,
          "aria-pressed": statusOf(state.map, id) === name ? "true" : "false"
        }, name);
        btn.addEventListener("click", function () { setStatus(id, name); });
        box.appendChild(btn);
      });
      return box;
    }

    function attachImage(shot, media, item) {
      var file = safeAsset(media && media.file);
      var original = safeHttpUrl(media && media.original) || safeHttpUrl(primarySource(item).url);
      if (!file) {
        shot.classList.add("is-failed", "is-link-only");
        var emptyBox = el(doc, "div", { class: "shot-fallback" });
        emptyBox.appendChild(el(doc, "p", null, "此例没有入库图片"));
        if (original) emptyBox.appendChild(link(doc, original, sourceVerb(original)));
        (item.media_links || []).forEach(function (src) {
          if (src && src.url) emptyBox.appendChild(link(doc, src.url, src.label || sourceVerb(src.url)));
        });
        shot.appendChild(emptyBox);
        return;
      }
      var contain = preferContain(media);
      if (contain) shot.classList.add("is-contain");
      var img = el(doc, "img", {
        src: file,
        alt: String((media && media.caption) || item.title).split("。")[0],
        loading: "eager",
        decoding: "sync"
      });
      var opener = el(doc, "a", { class: "media-link", href: "#case-" + item.id });
      opener.appendChild(img);
      opener.appendChild(el(doc, "span", { class: "visually-hidden" }, item.title));
      var pending = el(doc, "p", { class: "shot-status" }, "画面载入中");
      shot.classList.add("is-pending");
      shot.appendChild(opener);
      shot.appendChild(pending);
      var settled = false;
      var fail = function () {
        if (settled) return;
        settled = true;
        shot.classList.remove("is-pending");
        shot.classList.add("is-failed");
        if (opener.parentNode) opener.remove();
        if (pending.parentNode) pending.remove();
        Array.prototype.forEach.call(shot.querySelectorAll(".shot-tool"), function (node) { node.remove(); });
        var box = el(doc, "div", { class: "shot-fallback" });
        box.appendChild(el(doc, "p", null, "图片未能显示"));
        if (original) box.appendChild(link(doc, original, "打开原始图片来源"));
        shot.appendChild(box);
      };
      var ready = function () {
        if (settled) return;
        if (!(img.naturalWidth > 0)) { fail(); return; }
        settled = true;
        shot.classList.remove("is-pending");
        shot.classList.add("is-ready");
        if (pending.parentNode) pending.remove();
      };
      img.addEventListener("load", ready);
      img.addEventListener("error", function () {
        settled = false;
        fail();
      });
      if (img.complete) ready();
      if (settled && shot.classList.contains("is-failed")) return;
      var fit = el(doc, "button", { type: "button", class: "shot-tool fit-toggle", "aria-pressed": contain ? "true" : "false" }, contain ? "裁切浏览" : "完整显示");
      fit.addEventListener("click", function (event) {
        event.preventDefault();
        var on = !shot.classList.contains("is-contain");
        shot.classList.toggle("is-contain", on);
        fit.setAttribute("aria-pressed", on ? "true" : "false");
        fit.textContent = on ? "裁切浏览" : "完整显示";
      });
      shot.appendChild(fit);
      if (original) {
        var jump = link(doc, original, sourceVerb(original));
        jump.classList.add("shot-tool", "source-jump");
        shot.appendChild(jump);
      }
    }

    function renderCard(item) {
      var article = el(doc, "article", {
        class: "card",
        id: "card-" + item.id,
        "data-case-id": item.id,
        "data-category": item.category,
        "data-date": item.date_iso,
        "data-round": item.round || ""
      });
      var shot = el(doc, "div", { class: "shot" });
      attachImage(shot, (item.media || [])[0], item);
      article.appendChild(shot);
      var body = el(doc, "div", { class: "card-body" });
      var meta = el(doc, "p", { class: "meta" });
      meta.appendChild(el(doc, "span", null, item.category_label || item.category || ""));
      meta.appendChild(el(doc, "span", null, item.date_label || item.date_iso || ""));
      meta.appendChild(el(doc, "span", null, "置信 " + (item.confidence_label || "")));
      appendRecency(meta, item);
      appendRound(meta, item);
      body.appendChild(meta);
      var heading = el(doc, "h2");
      heading.appendChild(el(doc, "a", { class: "title-link", href: "#case-" + item.id }, item.title));
      body.appendChild(heading);
      body.appendChild(el(doc, "p", { class: "brand" }, item.brand || ""));
      if (item.summary) body.appendChild(el(doc, "p", { class: "summary" }, item.summary));
      if (item.advice) {
        var teaser = el(doc, "p", { class: "advice-teaser" });
        teaser.appendChild(el(doc, "span", { class: "advice-kicker" }, "建议，非已落地"));
        var opening = String(item.advice).split("。")[0];
        teaser.appendChild(doc.createTextNode(" " + opening + "。"));
        body.appendChild(teaser);
      }
      var source = primarySource(item);
      if (source.url) {
        var row = el(doc, "p", { class: "primary" });
        row.appendChild(link(doc, source.url, "主来源"));
        body.appendChild(row);
      }
      body.appendChild(stampBar(item.id));
      article.appendChild(body);
      return article;
    }

    function appendRecency(meta, item) {
      if (isNinety(item.date_iso, state.basis)) meta.appendChild(el(doc, "span", { class: "recent-tight" }, "近90天"));
      if (isRecent(item.date_iso, state.basis)) meta.appendChild(el(doc, "span", { class: "recent" }, "近6个月"));
    }

    function appendRound(meta, item) {
      var label = ext.roundMarks && ext.roundMarks[item.round];
      if (!label && item.round === "new" && ext.roundLabel) label = ext.roundLabel;
      if (label) meta.appendChild(el(doc, "span", { class: "round-flag" }, label));
    }

    function renderScale(item) {
      var scaleNode = el(doc, "div");
      var entries = Array.isArray(item.scale_evidence) ? item.scale_evidence : [];
      var scale = scaleState(item);
      if (!entries.length && scale.label) scaleNode.appendChild(el(doc, "p", { class: "unverified" }, scale.label));
      if (!entries.length && scale.recorded) scaleNode.appendChild(el(doc, "p", null, scale.recorded));
      entries.forEach(function (entry) {
        if (!entry) return;
        var block = el(doc, "div", { class: "scale-entry" });
        block.appendChild(el(doc, "p", { class: "scale-type" }, evidenceTypeLabel(entry.evidence_type)));
        if (entry.claim) block.appendChild(el(doc, "p", null, entry.claim));
        if (entry.source_url) block.appendChild(link(doc, entry.source_url, "查看来源"));
        if (entry.observed_at) block.appendChild(el(doc, "p", { class: "hint" }, "记录于 " + entry.observed_at));
        scaleNode.appendChild(block);
      });
      if (item.scale_limits) {
        scaleNode.appendChild(el(doc, "h3", null, "规模边界"));
        addParagraphs(doc, scaleNode, item.scale_limits);
      }
      if (entries.length && scale.recorded) {
        scaleNode.appendChild(el(doc, "p", { class: "hint" }, "此前热度记录：" + scale.recorded));
      }
      if (item.scale_update_note) scaleNode.appendChild(el(doc, "p", { class: "hint" }, item.scale_update_note));
      if (!entries.length && !scale.recorded && !item.scale_limits) {
        scaleNode.appendChild(el(doc, "p", { class: "unverified" }, "规模未核实"));
      }
      return scaleNode;
    }

    function section(title, node) {
      var box = el(doc, "section", { class: "section" });
      box.appendChild(el(doc, "h2", null, title));
      box.appendChild(node);
      return box;
    }

    function renderReader(item) {
      reader.textContent = "";
      var back = el(doc, "a", { class: "back", href: "#card-" + item.id, id: "back" }, "返回列表");
      reader.appendChild(back);
      var hero = el(doc, "div", { class: "shot", id: "reader-shot" });
      attachImage(hero, (item.media || [])[0], item);
      reader.appendChild(hero);
      var first = (item.media || [])[0];
      if (first && first.caption) reader.appendChild(el(doc, "p", { class: "detail-caption" }, first.caption));
      var meta = el(doc, "p", { class: "meta" });
      meta.appendChild(el(doc, "span", null, item.category_label || ""));
      meta.appendChild(el(doc, "span", null, item.date_label || item.date_iso || ""));
      meta.appendChild(el(doc, "span", null, "置信 " + (item.confidence_label || "")));
      appendRecency(meta, item);
      appendRound(meta, item);
      reader.appendChild(meta);
      reader.appendChild(el(doc, "h1", { id: "reader-title" }, item.title));
      reader.appendChild(el(doc, "p", { class: "brand" }, (item.brand || "") + (item.source_type ? " · " + item.source_type : "")));
      var bar = el(doc, "div", { class: "reader-status" });
      bar.appendChild(stampBar(item.id));
      bar.appendChild(el(doc, "p", { class: "foot-note", id: "reader-warn" }, warn && !warn.hidden ? warn.textContent : "挑选保存在这台浏览器，刷新后还在。"));
      reader.appendChild(bar);
      if (item.summary) reader.appendChild(el(doc, "p", { class: "summary" }, item.summary));
      if (item.window_note) reader.appendChild(el(doc, "p", { class: "time-note" }, item.window_note));

      var mechanism = el(doc, "div");
      mechanism.appendChild(el(doc, "p", null, item.ai_where || "材料未单列AI机制。"));
      if (item.evidence && item.evidence.length) {
        mechanism.appendChild(el(doc, "h3", null, "直接证据"));
        var ul = el(doc, "ul");
        item.evidence.forEach(function (line) { ul.appendChild(el(doc, "li", null, line)); });
        mechanism.appendChild(ul);
      }
      reader.appendChild(section("AI机制", mechanism));

      var frontier = frontierState(item);
      var frontierNode = el(doc, "p", { class: frontier.recorded ? "" : "unrecorded" }, frontier.text);
      reader.appendChild(section("前沿性", frontierNode));

      reader.appendChild(section("规模证据", renderScale(item)));

      var bench = el(doc, "div");
      addParagraphs(doc, bench, item.benchmark || "材料未单列对标价值。");
      reader.appendChild(section("对标价值", bench));

      if (item.audience) reader.appendChild(section("受众与触点", el(doc, "p", null, item.audience)));

      var tail = el(doc, "div");
      if (item.limits) {
        tail.appendChild(el(doc, "h3", null, "局限"));
        tail.appendChild(el(doc, "p", null, item.limits));
      }
      tail.appendChild(el(doc, "h3", null, "来源"));
      var sources = el(doc, "ul", { class: "src-list" });
      (item.sources || []).forEach(function (src) {
        var li = el(doc, "li");
        li.appendChild(link(doc, src.url, (src.label || "来源") + (src.url ? " · " + src.url : "")));
        if (src.status) li.appendChild(el(doc, "div", { class: "hint" }, src.status));
        sources.appendChild(li);
      });
      tail.appendChild(sources);
      var extras = (item.media || []).slice(1);
      var remote = item.remote_only || [];
      var links = item.media_links || [];
      if (extras.length || remote.length || links.length) {
        var moreAttrs = { class: "more-media" };
        if (!(item.media || []).length) moreAttrs.open = "open";
        var more = el(doc, "details", moreAttrs);
        more.appendChild(el(doc, "summary", null, (item.media || []).length ? "其余画面与原链" : "可打开的来源"));
        extras.forEach(function (shot) {
          var fig = el(doc, "div", { class: "shot" });
          attachImage(fig, shot, item);
          more.appendChild(fig);
          if (shot.caption) more.appendChild(el(doc, "p", { class: "detail-caption" }, shot.caption));
        });
        var extraList = el(doc, "ul", { class: "src-list" });
        remote.concat(links).forEach(function (src) {
          var li = el(doc, "li");
          li.appendChild(link(doc, src.url, (src.label || "原链") + (src.url ? " · " + src.url : "")));
          extraList.appendChild(li);
        });
        if (extraList.childNodes.length) more.appendChild(extraList);
        tail.appendChild(more);
      }
      reader.appendChild(section("来源与局限", tail));
      if (item.advice) {
        var suggestion = el(doc, "div");
        suggestion.appendChild(el(doc, "p", { class: "advice-kicker" }, "建议，非已落地"));
        addParagraphs(doc, suggestion, item.advice);
        var advice = section("对标建议", suggestion);
        advice.classList.add("advice");
        reader.appendChild(advice);
      }
      if (typeof ext.detailExtra === "function") ext.detailExtra({ doc: doc, el: el, link: link, item: item, data: state.data, container: reader });
      if (back.focus) back.focus();
    }

    function showLibrary(returnId) {
      state.openId = "";
      if (reader) reader.hidden = true;
      if (library) library.hidden = false;
      apply();
      if (!returnId) return;
      var card = doc.getElementById("card-" + returnId);
      if (!card || card.hidden) return;
      var settle = function () {
        var view = doc.defaultView;
        if (!view || card.hidden) return;
        var top = Math.max(0, card.getBoundingClientRect().top + (view.pageYOffset || view.scrollY || 0) - 96);
        var scroller = view.document && (view.document.scrollingElement || view.document.documentElement);
        var previous = scroller && scroller.style ? scroller.style.scrollBehavior : "";
        if (scroller && scroller.style) scroller.style.scrollBehavior = "auto";
        if (scroller) scroller.scrollTop = top;
        if (view.scrollTo) view.scrollTo(0, top);
        if (scroller && scroller.style) scroller.style.scrollBehavior = previous;
      };
      settle();
      if (doc.defaultView) doc.defaultView.setTimeout(settle, 0);
    }

    function showCase(id) {
      var item = null;
      state.cases.forEach(function (candidate) { if (candidate.id === id) item = candidate; });
      if (!item || !reader) {
        showLibrary("");
        return;
      }
      state.openId = id;
      rememberReturn(id);
      if (library) library.hidden = true;
      reader.hidden = false;
      renderReader(item);
      if (doc.defaultView && doc.defaultView.scrollTo) doc.defaultView.scrollTo(0, 0);
    }

    function syncRoute() {
      var id = parseCaseHash(doc.defaultView ? doc.defaultView.location.hash : "");
      if (id) showCase(id);
      else {
        var backTo = state.openId || "";
        if (!backTo) {
          try { backTo = root.sessionStorage.getItem(SCROLL_KEY) || ""; } catch (err) { backTo = ""; }
        }
        var hash = doc.defaultView ? String(doc.defaultView.location.hash || "") : "";
        if (!backTo && hash.indexOf("#card-") === 0) backTo = hash.slice(6);
        showLibrary(backTo);
      }
    }

    function renderNotes(data) {
      var sectionEl = doc.getElementById("limits");
      var holder = doc.getElementById("lim-list");
      if (!sectionEl || !holder) return;
      holder.textContent = "";
      var has = false;
      if (data.scope_note) {
        var note = el(doc, "details", { class: "limit-block" });
        note.appendChild(el(doc, "summary", null, "核验范围"));
        addParagraphs(doc, note, data.scope_note);
        holder.appendChild(note);
        has = true;
      }
      (data.appendix || []).forEach(function (item) {
        var box = el(doc, "details", { class: "limit-block" });
        box.appendChild(el(doc, "summary", null, item.heading || "说明"));
        addParagraphs(doc, box, item.body || "");
        holder.appendChild(box);
        has = true;
      });
      sectionEl.hidden = !has;
    }

    function isWide() {
      return doc.documentElement.clientWidth >= 800;
    }

    function syncFilterChrome() {
      state.wide = isWide();
      if (!filters || !filterToggle) return;
      if (state.wide) {
        filters.hidden = false;
        filterToggle.setAttribute("aria-expanded", "true");
      } else if (filterToggle.getAttribute("data-user") !== "open") {
        filters.hidden = true;
        filterToggle.setAttribute("aria-expanded", "false");
      }
      filterToggle.textContent = filters.hidden ? "筛选" : "收起筛选";
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
      var reset = doc.getElementById("reset-filters");
      if (reset) reset.addEventListener("click", resetFilters);
      if (filterToggle && filters) {
        filterToggle.addEventListener("click", function () {
          filters.hidden = !filters.hidden;
          filterToggle.setAttribute("data-user", filters.hidden ? "" : "open");
          filterToggle.setAttribute("aria-expanded", filters.hidden ? "false" : "true");
          filterToggle.textContent = filters.hidden ? "筛选" : "收起筛选";
        });
      }
      if (doc.defaultView) doc.defaultView.addEventListener("resize", syncFilterChrome);
      if (doc.defaultView) doc.defaultView.addEventListener("hashchange", syncRoute);

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
        download("ai-brand-selection.csv", "text/csv;charset=utf-8", toCsv(toExport(state.cases, state.map).selections));
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
          result.selections.forEach(function (row) {
            if (row.status === "未处理") delete state.map[row.id];
            else state.map[row.id] = row.status;
          });
          persist();
          apply();
          if (state.openId) showCase(state.openId);
          if (ioMsg) ioMsg.textContent = "已导入 " + result.selections.length + " 条" + (result.skipped ? "，跳过 " + result.skipped + " 条" : "") + "。";
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
        try { root.localStorage.removeItem(KEY); } catch (err) { /* persist reports the failure */ }
        persist();
        apply();
        if (state.openId) showCase(state.openId);
        dialog.close();
        if (ioMsg) ioMsg.textContent = "已清空挑选，案例回到未处理。";
      });
    }

    function boot(data) {
      if (!data || !Array.isArray(data.cases) || !data.cases.length) {
        showError("案例数据不完整。请确认 evidence.json 与页面在同一目录。");
        return;
      }
      state.data = data;
      state.cases = data.cases;
      state.basis = basisOf(data);
      var title = doc.getElementById("book-title");
      if (title && data.title) title.textContent = data.title;
      if (doc.title !== undefined && data.title) doc.title = data.title;
      var lead = doc.getElementById("book-lead");
      if (lead) lead.textContent = typeof ext.lead === "function" ? ext.lead(data) : (data.lead || DEFAULT_LEAD);
      var kicker = doc.getElementById("kicker");
      if (kicker) kicker.textContent = "核验日 " + (data.verified_on || state.basis.verified_on) + (data.timezone ? " · " + data.timezone : "");
      var hint = doc.getElementById("time-hint");
      if (hint) {
        var timeNote = data.time_basis && data.time_basis.note;
        hint.textContent = timeNote || ("近6个月：不早于 " + state.basis.filter_six_months_from + "。近12个月：不早于 " + state.basis.filter_twelve_months_from + "。更早：早于 " + state.basis.filter_twelve_months_from + "。以核验日 " + state.basis.verified_on + " 倒推。");
      }
      var foot = doc.getElementById("foot");
      if (foot) foot.textContent = "资料核验日 " + (data.verified_on || "") + "。挑选只在这台浏览器，不上传。打开页面不等于案例已被批准。";
      var roundFilters = ext.roundFilters || (ext.roundLabel ? [{ value: "new", label: ext.roundLabel }] : []);
      roundFilters = roundFilters.filter(function (entry) {
        return data.cases.some(function (item) { return item.round === entry.value; });
      });
      if (roundFilters.length) {
        var slot = doc.getElementById("round-slot");
        if (slot && !slot.querySelector("[data-filter-group=round]")) {
          var block = el(doc, "div", { class: "tool-block", role: "group", "aria-label": "轮次" });
          block.appendChild(el(doc, "span", { class: "tool-label" }, "轮次"));
          var row = el(doc, "div", { class: "chip-row", "data-filter-group": "round" });
          row.appendChild(el(doc, "button", { type: "button", "data-value": "all", "aria-pressed": "true" }, "全部轮次"));
          roundFilters.forEach(function (entry) {
            row.appendChild(el(doc, "button", { type: "button", "data-value": entry.value, "aria-pressed": "false" }, entry.label));
          });
          block.appendChild(row);
          slot.appendChild(block);
        }
      }
      var loaded = loadMap(root.localStorage, data.cases.map(function (item) { return item.id; }));
      state.map = loaded.map;
      if (loaded.error) setWarn("本浏览器里的挑选记录无法读取，已按未处理显示。之后的挑选仍会尝试保存。", true);
      data.cases.forEach(function (item) { list.appendChild(renderCard(item)); });
      renderNotes(data);
      var extra = doc.getElementById("extra");
      if (extra && typeof ext.listExtra === "function") ext.listExtra({ doc: doc, el: el, link: link, data: data, container: extra });
      if (loading) loading.hidden = true;
      wire();
      syncFilterChrome();
      if (doc.defaultView && doc.defaultView.history && doc.defaultView.history.scrollRestoration) {
        doc.defaultView.history.scrollRestoration = "manual";
      }
      syncRoute();
    }

    var embedded = options.data || readEmbedded(doc);
    if (embedded) {
      boot(embedded);
      return;
    }
    var fetcher = root.fetch;
    if (typeof fetcher !== "function") {
      showError("案例数据没有载入。当前环境不能读取 evidence.json。");
      return;
    }
    fetcher("evidence.json", { cache: "no-store" }).then(function (res) {
      if (!res.ok) throw new Error("status " + res.status);
      return res.json();
    }).then(boot).catch(function (err) {
      showError("案例数据没有载入。请在本目录用静态服务器打开页面；直接用文件地址打开时，浏览器会拦截 evidence.json。");
      if (typeof console !== "undefined") console.error(err);
    });
  }

  return {
    STATUSES: STATUSES,
    KEY: KEY,
    SCHEMA: SCHEMA,
    PUBLIC_BASIS: PUBLIC_BASIS,
    DEFAULT_LEAD: DEFAULT_LEAD,
    inWindow: inWindow,
    isRecent: isRecent,
    matchCase: matchCase,
    statusOf: statusOf,
    primarySource: primarySource,
    scaleState: scaleState,
    frontierState: frontierState,
    evidenceTypeLabel: evidenceTypeLabel,
    isNinety: isNinety,
    preferContain: preferContain,
    validateImport: validateImport,
    toCsv: toCsv,
    toExport: toExport,
    loadMap: loadMap,
    saveMap: saveMap,
    safeHttpUrl: safeHttpUrl,
    safeAsset: safeAsset,
    parseCaseHash: parseCaseHash,
    basisOf: basisOf,
    mount: mount
  };
});
