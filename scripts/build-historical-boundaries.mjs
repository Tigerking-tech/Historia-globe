#!/usr/bin/env node
// 历史边界图层抓取：从 Aligned Cliopatria v1.1 的 ArcGIS FeatureServer 按年份
// 拉取真实政体边界，生成静态 GeoJSON 供 3D 地球的时间滑块加载。
//
// 为什么选这个源：CC BY 4.0（仅需署名），且每个政体要素自带 Name / Wikipedia
// 字段，可以做到「逐要素可点出处」——这是本项目「每条都可核对」底线的前提。
// 相对地，★876 的 aourednik/historical-basemaps 是 GPL-3.0 且自述 WIP，
// 对要商业上线的项目不兼容，故不内置（登记在 lib/historical-boundaries.ts 供核对）。
//
// 输出（全部幂等、不含时间戳）：
//   public/boundaries/world_<year>.geojson   每个年份一个图层，供地球直接 fetch
//   data/historical-boundaries.json          图层清单与真实统计，供 API / 事实页
//
// 用法：
//   node scripts/build-historical-boundaries.mjs                    # 实抓
//   node scripts/build-historical-boundaries.mjs --soft-fail       # Vercel 构建期：失败不覆盖
//   node scripts/build-historical-boundaries.mjs --ci              # CI：写 Step Summary
//   node scripts/build-historical-boundaries.mjs --self-test       # 纯函数自检，不联网
//   node scripts/build-historical-boundaries.mjs --fixture=ok --out /tmp/x.json
//
// 退出码：0 成功 / 1 上游失败且无旧数据 / 2 上游失败但已保留旧数据（soft-fail 下返回 0）/ 3 自检失败

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "public", "boundaries");
const MANIFEST = path.join(ROOT, "data", "historical-boundaries.json");

const args = process.argv.slice(2);
const SOFT_FAIL = args.includes("--soft-fail");
const CI = args.includes("--ci");
const SELF_TEST = args.includes("--self-test");
const FIXTURE = args.find((a) => a.startsWith("--fixture="))?.slice(10) || null;
const OUT_ARG = args.find((a) => a.startsWith("--out="))?.slice(6) || null;

// 离散档位：覆盖数据集最早期到 1497 年，每个档位都对应一个真实可查的 Year。
// 不是连续年份插值——没有数据的年份绝不编造边界。
// 全部取自源清单 data/manifest.json 的 yearValues（333 个真实面板年）。
// 1200/1300/1400 不是该数据集的面板年，改用真实存在的 1210/1305/1402。
const YEARS = [-3400, -2000, -1000, -500, -323, -44, 1, 500, 800, 1000, 1210, 1305, 1402, 1497];

const ENDPOINT =
  "https://services2.arcgis.com/wx8u046p68e0iGuj/arcgis/rest/services/Aligned_Cliopatria_v1.1_WGS84/FeatureServer/0/query";

const SOURCE = {
  id: "cliopatria-aligned-v1.1",
  name: "Aligned Cliopatria v1.1 (UC Merced GIS Center)",
  licence: "CC BY 4.0",
  licenceUrl: "https://creativecommons.org/licenses/by/4.0/",
  sourceUrl:
    "https://services2.arcgis.com/wx8u046p68e0iGuj/arcgis/rest/services/Aligned_Cliopatria_v1.1_WGS84/FeatureServer/0",
  repository: "https://github.com/ucmerced-giscenter/cliopatria",
  doi: "https://doi.org/10.5281/zenodo.13363121",
  citation:
    "Bennett, J. S., Mutch, E., Tollefson, A., et al. (2025). Cliopatria – A geospatial database of world-wide political entities from 3400BCE to 2024CE. Scientific Data 12, 247.",
  coverage: "-3400 to 1497 (333 panel years in the source; 14 representative years bundled here)",
  accuracyNote:
    "Source states coverage 3400 BCE–1000 CE is reviewed and corrected; CE 1000–2024 will be appended after review and attribute values may still change. Boundaries are scholarly approximations of polity extent, not precise legal borders.",
  modifications:
    "Geometry simplified for web rendering (ring thinning and 4-decimal coordinate rounding); original Name, Type, Wikipedia and AreaSqKM values are preserved. No boundary was invented or interpolated.",
};

const MODERN = {
  year: 2026,
  file: "/countries.geojson",
  name: "Natural Earth 1:110m Admin-0 Countries",
  licence: "Public domain",
  licenceUrl: "https://www.naturalearthdata.com/about/terms-of-use/",
  note: "Present-day baseline already bundled with the site; not a historical reconstruction.",
};

// ---------- 纯函数（可自检，不依赖网络） ----------

function roundCoord(p) {
  return [Math.round(p[0] * 10000) / 10000, Math.round(p[1] * 10000) / 10000];
}

/** 环抽稀：控制每环最多约 maxPts 个点，保持首尾闭合，不移动任何保留点。 */
function simplifyRing(ring, maxPts = 100) {
  if (!Array.isArray(ring) || ring.length < 2) return ring;
  const step = Math.max(1, Math.ceil(ring.length / maxPts));
  const out = [];
  for (let i = 0; i < ring.length; i += step) out.push(roundCoord(ring[i]));
  const last = roundCoord(ring[ring.length - 1]);
  const tail = out[out.length - 1];
  if (tail[0] !== last[0] || tail[1] !== last[1]) out.push(last);
  // GeoJSON 线性环必须闭合
  const head = out[0];
  if (out[out.length - 1][0] !== head[0] || out[out.length - 1][1] !== head[1]) out.push([...head]);
  return out;
}

function simplifyGeometry(geom) {
  if (!geom || !Array.isArray(geom.coordinates)) return geom;
  if (geom.type === "Polygon") {
    return { type: "Polygon", coordinates: geom.coordinates.map((r) => simplifyRing(r)) };
  }
  if (geom.type === "MultiPolygon") {
    return {
      type: "MultiPolygon",
      coordinates: geom.coordinates.map((poly) => poly.map((r) => simplifyRing(r))),
    };
  }
  return geom;
}

function normalizeFeature(f, year) {
  const p = f?.properties || {};
  const name = typeof p.Name === "string" && p.Name.trim() ? p.Name.trim() : "Unnamed polity";
  const wiki = typeof p.Wikipedia === "string" && p.Wikipedia.trim() ? p.Wikipedia.trim() : "";
  return {
    type: "Feature",
    properties: {
      // NAME / ADMIN 是现有地球与国家标注层读取的字段，保持兼容
      NAME: name,
      ADMIN: name,
      name,
      year,
      type: typeof p.Type === "string" ? p.Type : "POLITY",
      areaSqKm: typeof p.AreaSqKM === "number" ? Math.round(p.AreaSqKM) : null,
      wikipedia: wiki,
      // 逐要素出处：维基条目（不是一手史料，页面如实标注）
      sourceUrl: wiki
        ? `https://en.wikipedia.org/wiki/${encodeURIComponent(wiki.replace(/\s+/g, "_"))}`
        : "",
      sourceType: "wikipedia-article-per-polity",
      licence: SOURCE.licence,
      dataset: SOURCE.id,
    },
    geometry: simplifyGeometry(f.geometry),
  };
}

function featureCollection(year, features) {
  return {
    type: "FeatureCollection",
    properties: {
      year,
      dataset: SOURCE.id,
      licence: SOURCE.licence,
      licenceUrl: SOURCE.licenceUrl,
      sourceUrl: SOURCE.sourceUrl,
      citation: SOURCE.citation,
      accuracyNote: SOURCE.accuracyNote,
      modifications: SOURCE.modifications,
      note: "Dataset-level provenance plus a per-polity Wikipedia link. These are scholarly approximations, not precise legal borders or primary historical sources.",
    },
    features,
  };
}

function serialize(obj) {
  return JSON.stringify(obj, null, 2) + "\n";
}

function buildManifest(layers) {
  return {
    status: "ok",
    dataset: SOURCE,
    modern: MODERN,
    panelYearsAvailableInSource: 333,
    bundledYears: layers.map((l) => l.year),
    layers,
    notes: [
      "Historical coverage ends at 1497 because that is the last reviewed year in Aligned Cliopatria v1.1; no boundary is invented for later years.",
      "Years between bundled panels are not interpolated. The slider snaps to the nearest real panel year.",
      "The GPL-3.0 historical-basemaps dataset (100-2010) is deliberately NOT bundled; see /facts/historical-boundaries-and-licences.",
    ],
  };
}

function selfTest() {
  const assert = (c, m) => {
    if (!c) throw new Error(m);
  };
  const ring = Array.from({ length: 500 }, (_, i) => [i * 0.01, i * 0.02]);
  ring.push([...ring[0]]);
  const s = simplifyRing(ring, 160);
  assert(s.length <= 162, "抽稀后点数超限");
  assert(s[0][0] === s[s.length - 1][0] && s[0][1] === s[s.length - 1][1], "线性环未闭合");
  assert(s[0][0] === 0 && s[0][1] === 0, "起点被改动");
  assert(s.some((p) => p[0] === Math.round(4.99 * 10000) / 10000) || s.length > 2, "中间点丢失");

  const short = [[0, 0], [1, 1], [2, 2], [0, 0]];
  assert(simplifyRing(short, 160).length >= 4, "短环被破坏");

  const poly = { type: "Polygon", coordinates: [ring] };
  assert(simplifyGeometry(poly).coordinates[0].length <= 162, "Polygon 抽稀失败");
  const multi = { type: "MultiPolygon", coordinates: [[ring], [short]] };
  assert(simplifyGeometry(multi).coordinates.length === 2, "MultiPolygon 结构丢失");

  const f = normalizeFeature(
    { properties: { Name: "Roman Republic", Type: "POLITY", Wikipedia: "Roman_Republic", AreaSqKM: 1234.5 }, geometry: poly },
    -44
  );
  assert(f.properties.NAME === "Roman Republic", "名称映射失败");
  assert(f.properties.year === -44, "年份映射失败");
  assert(f.properties.sourceUrl.startsWith("https://en.wikipedia.org/wiki/"), "逐要素出处缺失");
  assert(f.properties.licence === "CC BY 4.0", "许可标注缺失");

  const fc = featureCollection(-44, [f]);
  assert(fc.properties.citation.includes("Scientific Data"), "数据集引用缺失");
  const m = buildManifest([{ year: -44, file: "/boundaries/world_-44.geojson", polityCount: 1, withWikipedia: 1, bytes: 10 }]);
  assert(m.status === "ok" && m.layers.length === 1 && m.modern.year === 2026, "清单结构异常");
  assert(!("generatedAt" in m), "清单不得含时间戳（幂等）");
  assert(serialize(m) === serialize(m), "序列化不确定");
  assert(YEARS.every((y) => Number.isInteger(y)), "年份档位必须为整数");
  assert(YEARS[0] === -3400 && YEARS[YEARS.length - 1] === 1497, "年份覆盖范围变化");
  console.log("self-test: 14 项断言通过");
  return 0;
}

// ---------- 抓取 ----------

async function fetchYear(year, timeoutMs = 30000) {
  const qs = new URLSearchParams({
    where: `Year=${year}`,
    outFields: "OBJECTID,Year,AreaSqKM,Name,Color,Type,Wikipedia",
    f: "geojson",
    resultRecordCount: "2000",
    orderByFields: "OBJECTID",
  });
  const r = await fetch(`${ENDPOINT}?${qs.toString()}`, {
    headers: { "User-Agent": "HistoriaGlobe-BoundaryBuilder/1.0 (+https://historiaglobe.com/llms.txt)", Accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  if (!j || !Array.isArray(j.features)) throw new Error("响应不是合法 GeoJSON FeatureCollection");
  if (j.error) throw new Error(j.error.message || "ArcGIS 返回错误");
  if (j.properties?.exceededTransferLimit) throw new Error("超出单次传输上限，需分页");
  // 结构校验：不能只靠 features 数组存在，必须有真实几何
  const usable = j.features.filter((f) => f?.geometry?.coordinates);
  if (usable.length === 0) throw new Error("该年份无有效几何");
  return usable;
}

async function main() {
  if (SELF_TEST) return selfTest();

  // fixture 仅用于自检脚本流程，绝不写入仓库目录
  if (FIXTURE === "ok") {
    const fake = featureCollection(-44, [
      normalizeFeature({ properties: { Name: "Fixture polity", Wikipedia: "Fixture", AreaSqKM: 1 }, geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] } }, -44),
    ]);
    const m = buildManifest([{ year: -44, file: "/boundaries/world_-44.geojson", polityCount: 1, withWikipedia: 1, bytes: serialize(fake).length }]);
    const out = OUT_ARG || "/tmp/hb-fixture.json";
    fs.writeFileSync(out, serialize(m));
    console.log(`fixture ok -> ${out}（仅自检，不写入仓库）`);
    return 0;
  }

  const results = [];
  const files = new Map();
  const failures = [];

  for (const year of YEARS) {
    let ok = false;
    for (let attempt = 0; attempt < 3 && !ok; attempt++) {
      try {
        const raw = await fetchYear(year);
        const features = raw.map((f) => normalizeFeature(f, year));
        const fc = featureCollection(year, features);
        const text = serialize(fc);
        const file = `world_${year}.geojson`;
        files.set(path.join(OUT_DIR, file), text);
        results.push({
          year,
          file: `/boundaries/${file}`,
          polityCount: features.length,
          withWikipedia: features.filter((f) => f.properties.wikipedia).length,
          bytes: Buffer.byteLength(text),
          samplePolities: features.slice(0, 5).map((f) => f.properties.name),
        });
        ok = true;
        console.log(`  Year ${String(year).padStart(5)} -> ${features.length} 政体, ${(Buffer.byteLength(text) / 1024).toFixed(0)} KB`);
      } catch (e) {
        if (attempt === 2) failures.push(`${year}: ${e.message}`);
        else await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
      }
    }
  }

  if (failures.length) {
    console.error(`上游失败 ${failures.length}/${YEARS.length} 个年份，不覆盖已有数据：`);
    failures.forEach((f) => console.error("  " + f));
    const hasExisting = fs.existsSync(MANIFEST);
    if (CI) {
      fs.appendFileSync(
        process.env.GITHUB_STEP_SUMMARY || "/dev/null",
        `\n## 历史边界抓取\n\n失败 ${failures.length}/${YEARS.length} 个年份，已保留旧快照。\n\n${failures.map((f) => `- ${f}`).join("\n")}\n`
      );
    }
    if (SOFT_FAIL) {
      console.log("--soft-fail：失败已忽略，沿用现有静态图层");
      return 0;
    }
    return hasExisting ? 2 : 1;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const [p, text] of files) fs.writeFileSync(p, text);
  const manifest = buildManifest(results);
  fs.writeFileSync(MANIFEST, serialize(manifest));
  const totalBytes = results.reduce((n, r) => n + r.bytes, 0);
  const totalPolities = results.reduce((n, r) => n + r.polityCount, 0);
  const withWiki = results.reduce((n, r) => n + r.withWikipedia, 0);
  console.log(`\n完成：${results.length} 个年份图层 / ${totalPolities} 个政体 / ${withWiki} 条维基出处 / ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
  if (CI) {
    fs.appendFileSync(
      process.env.GITHUB_STEP_SUMMARY || "/dev/null",
      `\n## 历史边界抓取\n\nstatus=ok，${results.length} 个年份，${totalPolities} 个政体，${withWiki} 条逐要素维基出处，${(totalBytes / 1024 / 1024).toFixed(2)} MB。\n\n| 年份 | 政体数 | 带维基出处 | 体积 |\n| --- | --- | --- | --- |\n${results.map((r) => `| ${r.year} | ${r.polityCount} | ${r.withWikipedia} | ${(r.bytes / 1024).toFixed(0)} KB |`).join("\n")}\n`
    );
  }
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    console.error(`脚本异常：${e?.stack || e}`);
    process.exit(SOFT_FAIL ? 0 : 1);
  });
