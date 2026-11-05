#!/usr/bin/env node
/**
 * Historia Globe — 权威专题事件摄取脚本
 * ---------------------------------------------------------------------------
 * 用法:
 *   node scripts/ingest-domain.mjs emdat [--key EMDAT_API_KEY] [--from 2000] [--to 2024]
 *   node scripts/ingest-domain.mjs ucdp      # 校验 data/ucdp-ged.csv 是否就绪
 *
 * EM-DAT 通过官方公开 API 实时拉取并落盘为 data/emdat.csv (需免费 token)。
 * UCDP 是注册后下载的数据集: 把官方 CSV 放到 data/ 后, 本脚本校验列名与
 * 坐标覆盖率, 确认能被 lib/domain-sources.ts 的解析器直接消费。
 *
 * 注意: 恐袭类事件不取自 GTD (其 EULA 仅限非商业, 商用需单独书面授权),
 * 而是来自 Wikidata (CC0, 商用自由) — 见 lib/history.ts。本脚本不处理 GTD。
 *
 * 所有脚本均零依赖、可单独 node 运行, 不参与 Next 构建。
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const EMDAT_OUT = path.join(DATA_DIR, "emdat.csv");

// ---------- 迷你 CSV 解析 (兼容带引号字段) ----------
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false;
      } else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function colIndex(header, candidates) {
  const lower = header.map((h) => h.trim().toLowerCase());
  for (const c of candidates) {
    const i = lower.indexOf(c.toLowerCase());
    if (i >= 0) return i;
  }
  return -1;
}
const get = (row, i) => (i >= 0 && row[i] != null ? row[i].trim() : "");
const toFloat = (s) => { const n = parseFloat(s); return Number.isFinite(n) ? n : NaN; };
const validCoord = (lat, lon) =>
  Number.isFinite(lat) && Number.isFinite(lon) &&
  Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && !(lat === 0 && lon === 0);

// ---------- 各源期望的列 (与 lib/domain-sources.ts 对齐) ----------
const EXPECT = {
  ucdp: {
    label: "UCDP GED",
    file: "ucdp-ged.csv",
    required: ["year", "month", "day", "latitude", "longitude"],
    optional: ["event_type", "country", "best", "event_id_cnty"],
  },
};

function validateLocal(source) {
  const cfg = EXPECT[source];
  const file = path.join(DATA_DIR, cfg.file);
  if (!fs.existsSync(file)) {
    console.log(`\n[${cfg.label}] ✗ 未找到 ${file}`);
    console.log(`  → 去官网注册下载后, 把 CSV 命名为 ${cfg.file} 放到 data/ 目录。`);
    return;
  }
  const rows = parseCsv(fs.readFileSync(file, "utf8"));
  if (rows.length < 2) { console.log(`\n[${cfg.label}] ✗ 文件为空或只有表头`); return; }
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const missing = cfg.required.filter((c) => !header.includes(c.toLowerCase()));
  let withCoord = 0, total = 0;
  for (let r = 1; r < rows.length; r++) {
    const lat = toFloat(get(rows[r], colIndex(header, ["latitude"])));
    const lon = toFloat(get(rows[r], colIndex(header, ["longitude"])));
    total++;
    if (validCoord(lat, lon)) withCoord++;
  }
  console.log(`\n[${cfg.label}] ✓ 文件就绪: ${cfg.file}`);
  console.log(`  总行数: ${total}`);
  console.log(`  有效坐标行: ${withCoord} (${(100 * withCoord / Math.max(total, 1)).toFixed(1)}%)`);
  if (missing.length) {
    console.log(`  ⚠ 缺少解析器需要的列: ${missing.join(", ")} — 解析器将跳过这些字段, 建议核对版本。`);
  } else {
    console.log(`  ✓ 关键列齐全, 可被 lib/domain-sources.ts 直接消费。`);
  }
  console.log(`  下一步: 重启服务, 地球仪将自动点亮 ${cfg.label} 事件。`);
}

// ---------- EM-DAT 实时摄取 ----------
async function ingestEmdat(opts) {
  const key = opts.key || process.env.EMDAT_API_KEY;
  if (!key) {
    console.log("\n[EM-DAT] ✗ 缺少 API token。");
    console.log("  → 免费申请: https://www.emdat.be/ (注册后在 Dashboard 生成 API key)");
    console.log("  → 然后: EMDAT_API_KEY=xxxx node scripts/ingest-domain.mjs emdat");
    return;
  }
  const from = opts.from || 2000;
  const to = opts.to || new Date().getFullYear();
  const BASE = "https://public.emdat.be/api/v2/events";
  const SELECT = [
    "country", "year", "month", "day", "latitude", "longitude",
    "disaster_type", "disaster_subtype", "total_deaths", "dis_no",
  ].join(",");
  const where = encodeURIComponent(JSON.stringify({ year: { gte: from, lte: to } }));

  fs.mkdirSync(DATA_DIR, { recursive: true });
  let offset = 0, limit = 500, total = 0, fetched = 0;
  const outRows = [["year","month","day","latitude","longitude","disaster type","disaster subtype","country","total deaths","dis no"]];
  console.log(`\n[EM-DAT] 拉取 ${from}–${to} 全量事件 ...`);
  while (true) {
    const url = `${BASE}?select=${SELECT}&where=${where}&limit=${limit}&offset=${offset}`;
    const res = await fetch(url, { headers: { "x-api-key": key } });
    if (!res.ok) {
      console.log(`  ✗ HTTP ${res.status}: ${await res.text().catch(() => "")}`);
      console.log("  → 检查 token 是否有效 / 配额是否用尽。");
      return;
    }
    const j = await res.json();
    const batch = Array.isArray(j) ? j : (j.data || []);
    if (batch.length === 0) break;
    if (total === 0 && batch[0]) {
      console.log("  样本字段:", Object.keys(batch[0]).join(", "));
    }
    for (const e of batch) {
      outRows.push([
        e.year ?? "", e.month ?? "", e.day ?? "",
        e.latitude ?? "", e.longitude ?? "",
        e.disaster_type ?? "", e.disaster_subtype ?? "",
        e.country ?? "", e.total_deaths ?? "", e.dis_no ?? "",
      ]);
    }
    fetched += batch.length;
    total = j.metadata?.total ?? (total || fetched);
    offset += limit;
    process.stdout.write(`\r  已拉取 ${fetched} / ${total || "?"}`);
    if (batch.length < limit) break;
  }
  // 写 CSV (简单转义)
  const esc = (v) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  fs.writeFileSync(EMDAT_OUT, outRows.map((r) => r.map(esc).join(",")).join("\n") + "\n", "utf8");
  console.log(`\n[EM-DAT] ✓ 已写入 ${EMDAT_OUT} (${outRows.length - 1} 行)`);
  console.log("  下一步: 重启服务, 地球仪将自动点亮 EM-DAT 灾害事件。");
}

// ---------- CLI ----------
const [,, cmd, ...rest] = process.argv;
const flags = {};
for (let i = 0; i < rest.length; i++) {
  if (rest[i] === "--key") flags.key = rest[++i];
  else if (rest[i] === "--from") flags.from = parseInt(rest[++i], 10);
  else if (rest[i] === "--to") flags.to = parseInt(rest[++i], 10);
}
if (cmd === "emdat") ingestEmdat(flags);
else if (cmd === "ucdp") validateLocal("ucdp");
else {
  console.log("用法:");
  console.log("  node scripts/ingest-domain.mjs emdat [--key TOKEN] [--from 2000] [--to 2024]");
  console.log("  node scripts/ingest-domain.mjs ucdp");
}
