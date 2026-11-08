#!/usr/bin/env node
// 外部数据源「境外可达性」自动探测：由 GitHub Actions 的境外 runner 定时跑。
//
// 目的：把「沙箱里拿不到 / 连不上」从一句口头判断，变成可持续复核的境外事实。
// 沙箱网络对多数境外源超时，但 CI runner 在境外——两者结论可能不同，不能混为一谈。
// 本脚本只观测、不断言、不改数据、不提交任何文件；结果写进 Step Summary。
//
// 同时探测历史边界候选源，用来核对「时间滑块需要历史国界数据集」这一项到底
// 是「境外也没有可用源」还是「有源但属于功能开发工作量」——避免凭沙箱一次
// 超时就下「改不掉」的结论。
//
// 零第三方依赖，Node 22+ 全局 fetch。

import fs from "node:fs";

const TIMEOUT = 12000;
const UA = "HistoriaGlobe-SourceProbe/1.0 (+https://historiaglobe.com/llms.txt)";

const TARGETS = [
  { group: "抓数脚本实际使用的源", key: "wikimedia-feed", label: "Wikimedia On this day feed", url: "https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/all/07/20" },
  { group: "抓数脚本实际使用的源", key: "wikipedia-restbase", label: "Wikipedia RESTBase onthisday", url: "https://en.wikipedia.org/api/rest_v1/feed/onthisday/all/07/20" },
  { group: "抓数脚本实际使用的源", key: "wikimedia-pageviews", label: "Wikimedia Pageviews API", url: "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia.org/all-access/user/July_20/daily/20240701/20240731" },
  { group: "运行时探测接口用到的源", key: "wikipedia-api", label: "Wikipedia Action API", url: "https://en.wikipedia.org/w/api.php?action=query&meta=siteinfo&format=json" },
  { group: "运行时探测接口用到的源", key: "wikidata-sparql", label: "Wikidata SPARQL", url: "https://query.wikidata.org/sparql?query=ASK%7B%7D&format=json" },
  { group: "运行时探测接口用到的源", key: "unesco", label: "UNESCO World Heritage dataset", url: "https://data.unesco.org/api/explore/v2.1/catalog/datasets/whc001/records?limit=1" },
  { group: "历史边界候选数据源", key: "openhistoricalmap", label: "OpenHistoricalMap", url: "https://openhistoricalmap.org/" },
  { group: "历史边界候选数据源", key: "world-historical-gazetteer", label: "World Historical Gazetteer", url: "https://www.worldhistoricalgazetteer.org/" },
  { group: "历史边界候选数据源", key: "naturalearth", label: "Natural Earth", url: "https://www.naturalearthdata.com/" },
];

async function probe(t) {
  const started = Date.now();
  try {
    const r = await fetch(t.url, {
      headers: { "User-Agent": UA, Accept: "*/*" },
      signal: AbortSignal.timeout(TIMEOUT),
      redirect: "follow",
      cache: "no-store",
    });
    // 读一小段即可，避免把大响应拉进内存；只要拿到状态码。
    await r.arrayBuffer().catch(() => null);
    return { ...t, ok: r.ok, status: r.status, ms: Date.now() - started, error: "" };
  } catch (e) {
    return {
      ...t,
      ok: false,
      status: 0,
      ms: Date.now() - started,
      error: String(e?.cause?.code || e?.name || e),
    };
  }
}

async function main() {
  const rows = await Promise.all(TARGETS.map(probe));
  const reachable = rows.filter((r) => r.ok).length;

  const lines = [
    "## 外部数据源境外可达性探测",
    "",
    ` runner 出口实测 · ${new Date().toISOString()} · 可达 **${reachable}/${rows.length}**`,
    "",
    "> 只观测不判成败。沙箱与 runner 出口不同，本表是「沙箱拿不到的数据」在境外的真实可得性证据。",
    "",
    "| 分组 | 源 | 结果 | HTTP | 耗时 | 错误 |",
    "| --- | --- | --- | --- | --- | --- |",
  ];
  for (const r of rows) {
    const mark = r.ok ? "可达" : "不可达";
    lines.push(`| ${r.group} | ${r.label} | ${mark} | ${r.status || "-"} | ${r.ms}ms | ${r.error || "-"} |`);
  }
  lines.push(
    "",
    "### 怎么读这张表",
    "",
    "- 「抓数脚本实际使用的源」若多数可达，即证明 push 后由 CI 抓数、再把快照回写 main 的机制成立；沙箱里的超时只是本地网络限制。",
    "- 「历史边界候选数据源」只说明数据集站点是否连得上。把历史国界做成时间滑块仍需几何数据、许可审查与前端开发，属于功能开发，不是一次 workflow 能产出的数据。",
    "- 某些站点对自动化 UA 返回 403 属正常，如实记录，不改写状态码、不重试掩盖。",
    "",
  );

  const md = lines.join("\n");
  console.log(md);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
  process.exit(0);
}

main().catch((e) => {
  console.error(`探测脚本异常：${e?.stack || e}`);
  process.exit(1);
});
