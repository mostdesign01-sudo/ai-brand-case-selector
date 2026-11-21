# AI品牌案例筛选册

二十例已核验的公开 AI 品牌案例：IP 10 例、品牌 4 例、形象 6 例。页面按「先看画面和日期，再读证据，再做挑选」来排：列表负责浏览，案例页负责证据，挑选状态贴在案例标题旁边。

证据顺序是 AI 机制、前沿性、规模证据、对标价值、受众与触点、来源与局限。每条案例最后有「对标建议」，并标明「建议，非已落地」。没有单独核实过的规模不打分，页面写明「规模未核实」，或标明公司陈述未经独立核验。近 6 个月、近 12 个月和更早按站点日期计算；各例自己的时间窗说明保持原记录。

挑选状态写在本机 `localStorage` 键 `ai-brand-case-selection-v1`，仍是案例编号到「未处理 / 入选 / 候补 / 暂不考虑」的映射。旧记录会照原样读出。导出的 CSV / JSON 沿用 `ai-brand-case-selection/v1`，导入只按案例编号写回状态，不上传。

图片是公开报道或官方频道的封面和配图，并在案例页保留说明。没有入库静帧的案例只给出可打开的来源链接。完整影片只链接到原始页面。

## 本地打开

在本目录启动静态服务器后打开首页。直接用文件地址打开时，浏览器会拦截 `evidence.json`。

```bash
python3 -m http.server 8765
```

时间筛选以站点日期 2026-11-21（Asia/Taipei）计算。近 6 个月指不早于 2026-05-21，近 12 个月指不早于 2025-11-21，近 90 天指不早于 2026-08-23。各例 `window`、`window_note` 与 `verified_on` 不按这一基准回写。最先收录的 6 例记录于 2026-11-19，其后 14 例分别记录于 2026-11-20 与 2026-11-21。

## 离线单页

`tools/bundle-local.mjs` 可以把一份案例数据和本页界面打成不依赖网络读取 JSON 的本地文件夹。它不包含任何一份具体研究的内容。

```bash
node tools/bundle-local.mjs \
  --data evidence.json \
  --assets assets \
  --js assets/app.js \
  --css assets/styles.css \
  --template index.html \
  --out /tmp/case-bundle \
  --standalone standalone.html
```

## 检查

```bash
node tests/public-site.mjs
```
