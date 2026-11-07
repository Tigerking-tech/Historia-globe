#!/usr/bin/env node
// 研究用快照：Wikipedia 官方 Pageviews API，为 SEO 报告提供「按日期查历史」的真实流量与季节性数字。
// 沙箱里该 API 直连与网页抓取通道均超时；GitHub Actions 境外 runner 可访问。
// 输出 data/market-pageviews.json，只上传为 CI artifact，不提交仓库、不进站点构建。
//
// 用法：node scripts/fetch-pageviews.mjs [--ci]

import { writeFile, appendFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "data", "market-pageviews.json");
const API =
  "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user";
const UA = "HistoriaGlobe/1.0 (research snapshot; contact hello@historiaglobe.com)";
const CI = process.argv.includes("--ci");
// 取代表性日期条目，用来观察「具体某一天的历史」是否存在可复用的季节性尖峰。
const ARTICLES = [
  "July_20",
  "July_4",
  "December_25",
  "January_1",
  "November_11",
  "October_4",
];

const fmt = (d) => d.toISOString().slice(0, 10).replace(/-/g, "") + "00";
const end = new Date(Date.now() - 2 * 86400e3); // Pageviews 数据有约 1-2 天滞后
const start = new Date(end.getTime() - 365 * 86400e3);

function summarize(article, items) {
  const views = items
    .map((i) => ({ date: String(i.timestamp).slice(0, 8), views: Number(i.views) || 0 }))
    .filter((x) => x.date && Number.isFinite(x.views));
  if (views.length === 0) return null;
  const sorted = views.map((x) => x.views).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const peak = views.reduce((a, b) => (b.views > a.views ? b : a), views[0]);
  return {
    article,
    days: views.length,
    totalViews: sorted.reduce((a, b) => a + b, 0),
    medianDailyViews: median,
    peak,
    peakToMedianRatio: median > 0 ? Number((peak.views / median).toFixed(2)) : null,
  };
}

async function fetchArticle(article) {
  const url = `${API}/${article}/daily/${fmt(start)}/${fmt(end)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return Array.isArray(json?.items) ? json.items : [];
}

async function writeSummary(lines) {
  for (const l of lines) console.log(`[fetch-pageviews] ${l}`);
  if (!CI || !process.env.GITHUB_STEP_SUMMARY) return;
  await appendFile(
    process.env.GITHUB_STEP_SUMMARY,
    ["## Wikipedia Pageviews 研究快照", "", ...lines.map((l) => `- ${l}`), ""].join("\n") + "\n",
    "utf8",
  ).catch(() => {});
}

async function main() {
  const rows = [];
  const errors = [];
  for (const article of ARTICLES) {
    try {
      const items = await fetchArticle(article);
      const s = summarize(article, items);
      if (s) rows.push(s);
      else errors.push(`${article}: 响应无 items`);
    } catch (e) {
      errors.push(`${article}: ${e.name}: ${e.message}`);
    }
  }

  const payload = {
    status: rows.length === 0 ? "unavailable" : rows.length === ARTICLES.length ? "ok" : "partial",
    source: "Wikimedia Pageviews REST API",
    window: { from: fmt(start), to: fmt(end) },
    note: "研究用快照：仅用于 SEO 报告的季节性判断，不进站点构建、不提交仓库。",
    articles: rows,
    errors,
  };
  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(payload, null, 2) + "\n", "utf8");

  const lines = [
    `status = ${payload.status}`,
    `成功条目 = ${rows.length}/${ARTICLES.length}`,
    ...rows.map(
      (r) =>
        `${r.article}: 中位 ${r.medianDailyViews}/日，峰值 ${r.peak.views} (${r.peak.date})，峰值/中位 ${r.peakToMedianRatio}x`,
    ),
  ];
  if (errors.length) lines.push(`失败 = ${errors.join("; ")}`);
  await writeSummary(lines);
  return rows.length === 0 ? 1 : 0;
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    console.error("[fetch-pageviews] 未预期错误：", e);
    process.exit(2);
  });
