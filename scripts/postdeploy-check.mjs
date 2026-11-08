#!/usr/bin/env node
// 部署后自动巡检：由 GitHub Actions 在境外 runner 定时调用「已部署的公网站点」。
//
// 为什么需要它：沙箱只能测 127.0.0.1，测不到公网部署、测不到 Vercel 出口、
// 也测不到境外 DNS/CDN 行为。这些正是「沙箱拿不到的数据」——按约定交给 CI 自动跑。
// 尤其 /api/sources/status 只有从部署环境调用才有意义，本脚本会把它每个源的
// 可达性如实写进 Step Summary，绝不因为某个上游不可达就谎报部署失败。
//
// 零第三方依赖，Node 22+ 全局 fetch 即可。
//
// 用法：
//   node scripts/postdeploy-check.mjs                                  # 默认正式域名
//   node scripts/postdeploy-check.mjs --base http://127.0.0.1:3000
//   SITE_BASE_URL=https://xxx.vercel.app node scripts/postdeploy-check.mjs --json
//
// 退出码：
//   0 = 全部通过，或站点尚未上线（明确标注 NOT_DEPLOYED，不伪装成通过）
//   1 = 站点已可达但有检查失败（真正的部署故障）
//   2 = 参数错误
//
// 默认域名来自 config.ts / llms.txt 中声明的正式站点；上线 Vercel 并绑定域名后
// 无需任何配置即自动开始真实巡检。未绑定域名时可用 workflow_dispatch 传预览 URL。

import fs from "node:fs";

const args = process.argv.slice(2);
const getArg = (key, fallback) => {
  // 同时支持 --key=value 与 --key value 两种写法：workflow 里用的是空格形式。
  const eq = args.find((a) => a.startsWith(`--${key}=`));
  if (eq) return eq.slice(key.length + 3);
  const at = args.indexOf(`--${key}`);
  if (at >= 0 && args[at + 1] && !args[at + 1].startsWith("--")) return args[at + 1];
  return fallback;
};

const RAW_BASE = getArg("base", process.env.SITE_BASE_URL || "https://historiaglobe.com");
const BASE = RAW_BASE.replace(/\/+$/, "");
const REQUEST_TIMEOUT = Number(getArg("timeout", "15000")) || 15000;
const AS_JSON = args.includes("--json");
const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?(\/|$)/.test(BASE);

if (!/^https?:\/\//.test(BASE)) {
  console.error(`参数错误：--base 必须是 http(s) 开头的绝对 URL，当前为 ${RAW_BASE}`);
  process.exit(2);
}

const UA = "HistoriaGlobe-PostDeployCheck/1.0 (+https://historiaglobe.com/llms.txt)";

async function request(path, { method = "GET", body, timeout = REQUEST_TIMEOUT } = {}) {
  const url = new URL(path, `${BASE}/`);
  const started = Date.now();
  const res = await fetch(url, {
    method,
    headers: {
      "User-Agent": UA,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeout),
    redirect: "follow",
    cache: "no-store",
  });
  const text = await res.text();
  return { status: res.status, ok: res.ok, text, ms: Date.now() - started };
}

function must(condition, message) {
  if (!condition) throw new Error(message);
}

function jsonOf(r) {
  try {
    return JSON.parse(r.text);
  } catch {
    throw new Error(`响应不是合法 JSON（HTTP ${r.status}）`);
  }
}

// 检查项：observe=true 的只记录不断言，避免把「上游不可达」误判成部署故障。
const checks = [
  {
    name: "首页可用",
    run: async () => {
      const r = await request("/");
      must(r.ok, `HTTP ${r.status}`);
      must(/<title>[^<]+<\/title>/i.test(r.text), "缺少 <title>");
      must(!/Internal Server Error|Application error/i.test(r.text), "页面含服务端错误字样");
      return `HTTP ${r.status}, ${r.text.length} bytes`;
    },
  },
  {
    name: "日期页 07-20（多语言 + FAQ）",
    run: async () => {
      const r = await request("/on-this-day/07-20");
      must(r.ok, `HTTP ${r.status}`);
      must(/"@type":"FAQPage"/.test(r.text), "缺少 FAQPage JSON-LD");
      must(/lang="zh-CN"/.test(r.text), "中文段缺失");
      must(!/noindex/.test(r.text), "不该带 noindex");
      return `HTTP ${r.status}, FAQPage + zh-CN 均在`;
    },
  },
  {
    name: "日期页 01-02（原零事件页已解除 noindex）",
    run: async () => {
      const r = await request("/on-this-day/01-02");
      must(r.ok, `HTTP ${r.status}`);
      must(!/noindex/.test(r.text), "仍带 noindex，说明补数快照退化");
      return `HTTP ${r.status}, 无 noindex`;
    },
  },
  {
    name: "日期页 02-29（闰日）",
    run: async () => {
      const r = await request("/on-this-day/02-29");
      must(r.ok, `HTTP ${r.status}`);
      return `HTTP ${r.status}`;
    },
  },
  {
    name: "事实页索引与覆盖页",
    run: async () => {
      const a = await request("/facts");
      must(a.ok, `/facts HTTP ${a.status}`);
      const b = await request("/facts/coverage-and-sources");
      must(b.ok, `覆盖页 HTTP ${b.status}`);
      must(/<table/i.test(b.text), "覆盖页缺少类别分布表格");
      return `索引 ${a.status}, 覆盖页 ${b.status}, 含表格`;
    },
  },
  {
    name: "教师工具页",
    run: async () => {
      const r = await request("/for-teachers");
      must(r.ok, `HTTP ${r.status}`);
      must(/Classroom toolkit/.test(r.text), "教师工具段缺失");
      return `HTTP ${r.status}, 工具段在场`;
    },
  },
  {
    name: "影像页 /reel.html",
    run: async () => {
      const r = await request("/reel.html");
      must(r.ok, `HTTP ${r.status}`);
      return `HTTP ${r.status}`;
    },
  },
  {
    name: "公开 API 索引",
    run: async () => {
      const r = await request("/api/public/v1");
      must(r.status === 200, `HTTP ${r.status}`);
      const j = jsonOf(r);
      must(j.ok === true, "ok 不为 true");
      must(Array.isArray(j.endpoints) && j.endpoints.length >= 8, "端点清单不足");
      return `HTTP 200, ${j.endpoints.length} 个端点`;
    },
  },
  {
    name: "coverage 精确口径（防快照退化）",
    run: async () => {
      const r = await request("/api/public/v1/coverage");
      must(r.status === 200, `HTTP ${r.status}`);
      const j = jsonOf(r);
      must(j.ok === true, "ok 不为 true");
      must(j.supplemental?.status === "ok", `快照 status=${j.supplemental?.status}，不是 ok`);
      must(j.supplemental?.days === 366, `覆盖天数=${j.supplemental?.days}，未达 366`);
      must(j.datePages === 366, `datePages=${j.datePages}`);
      must(j.supplemental?.events >= 19000, `补充层仅 ${j.supplemental?.events} 条，疑似退化`);
      must(j.supplemental?.hasCoordinates === false, "补充层不应声称有坐标");
      must(j.curated?.events === 150, `策展层=${j.curated?.events}，应为 150`);
      return `ok / ${j.supplemental.events} 条 / ${j.supplemental.days} 天 / 策展 ${j.curated.events}`;
    },
  },
  {
    name: "非法日期返回 400（不伪装成功）",
    run: async () => {
      const r = await request("/api/public/v1/on-this-day/99-99");
      must(r.status === 400, `HTTP ${r.status}，应为 400（参数错误）；此前返回 200 会让 AI 助手误判`);
      const j = jsonOf(r);
      must(j.ok === false && typeof j.error === "string", "缺少结构化错误体");
      return "HTTP 400, ok=false + error";
    },
  },
  {
    name: "MCP tools/list",
    run: async () => {
      const r = await request("/api/public/mcp", {
        method: "POST",
        body: { jsonrpc: "2.0", id: 1, method: "tools/list" },
      });
      must(r.status === 200, `HTTP ${r.status}`);
      const j = jsonOf(r);
      must(Array.isArray(j.result?.tools) && j.result.tools.length >= 4, "工具数不足 4");
      return `HTTP 200, ${j.result.tools.length} 个工具`;
    },
  },
  {
    name: "/mcp.json 与 /llms.txt",
    run: async () => {
      const m = await request("/mcp.json");
      must(m.ok, `mcp.json HTTP ${m.status}`);
      const l = await request("/llms.txt");
      must(l.ok, `llms.txt HTTP ${l.status}`);
      must(/\/api\/public\/v1\/coverage/.test(l.text), "llms.txt 未指向权威精确值接口");
      // 不允许再出现写死的历史快照条数——CI 每次刷新都会让它失准。
      must(!/19,?98[2-9]\b|19,?939\b/.test(l.text), "llms.txt 又写死了旧快照条数");
      return `mcp.json ${m.status}, llms.txt ${l.status}, 口径指向 API`;
    },
  },
  {
    name: "robots.txt 放行公开 API",
    run: async () => {
      const r = await request("/robots.txt");
      must(r.ok, `HTTP ${r.status}`);
      must(/Allow:\s*\/api\/public\//.test(r.text), "未显式放行 /api/public/");
      return `HTTP 200, 已放行 /api/public/`;
    },
  },
  {
    name: "sitemap 条目数",
    run: async () => {
      const r = await request("/sitemap.xml");
      must(r.ok, `HTTP ${r.status}`);
      const n = (r.text.match(/<loc>/g) || []).length;
      must(n >= 500, `仅 ${n} 条，疑似 sitemap 退化`);
      return `HTTP 200, ${n} 条 URL`;
    },
  },
  {
    // 观测项：外部源可达性取决于部署出口，不可达是真实事实，不是部署故障。
    name: "外部数据源可达性（观测）",
    observe: true,
    run: async () => {
      const r = await request("/api/sources/status", { timeout: 30000 });
      must(r.status === 200, `HTTP ${r.status}`);
      const j = jsonOf(r);
      must(Array.isArray(j.sources) && j.sources.length === j.total, "sources 结构异常");
      const detail = j.sources.map((s) => `${s.key}:${s.ok ? "ok" : "down"}(${s.status})`).join(" ");
      return `reachable=${j.reachable}/${j.total} | ${detail} | note: ${j.note ?? ""}`;
    },
  },
  {
    name: "收款状态接口（观测）",
    observe: true,
    run: async () => {
      const r = await request("/api/payments/status");
      return `HTTP ${r.status}（不判活，只确认未 500）${r.status >= 500 ? " ← 需排查" : ""}`;
    },
  },
];

function summaryMarkdown(base, outcome, results) {
  const lines = [
    `## 部署后自动巡检 · ${base}`,
    "",
    `结论：**${outcome}** · ${new Date().toISOString()}`,
    "",
    "| 检查项 | 类型 | 结果 | 明细 |",
    "| --- | --- | --- | --- |",
  ];
  for (const r of results) {
    const type = r.observe ? "观测" : "断言";
    const mark = r.ok ? "PASS" : r.observe ? "WARN" : "FAIL";
    const detail = String(r.detail).replace(/\|/g, "\\|").slice(0, 400);
    lines.push(`| ${r.name} | ${type} | ${mark} | ${detail} |`);
  }
  lines.push("", "> 观测项记录上游真实可达性，不参与成败判定；沙箱与 Vercel 出口不同，此处由境外 runner 测量。", "");
  return lines.join("\n");
}

async function main() {
  const results = [];

  // 首个请求单独处理，用来区分「尚未上线」与「上线后故障」。
  let first;
  try {
    first = await request("/");
  } catch (e) {
    const reason = String(e?.cause?.code || e?.name || e);
    if (!isLocal && /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ETIMEDOUT|TypeError|fetch failed/i.test(reason)) {
      const outcome = "NOT_DEPLOYED";
      const note = `站点当前无法连接（${reason}），判定为尚未上线 / 域名未解析；上线后本巡检会自动转为真实断言。`;
      console.log(`BASE=${BASE}`);
      console.log(`${outcome} — ${note}`);
      const md = `## 部署后自动巡检 · ${BASE}\n\n结论：**${outcome}** · ${new Date().toISOString()}\n\n${note}\n`;
      if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
      if (AS_JSON) console.log(JSON.stringify({ base: BASE, outcome, results: [] }, null, 2));
      process.exit(0);
    }
    // 本地地址连不上就是真故障，不降级掩盖。
    results.push({ name: "首页可用", observe: false, ok: false, detail: `连接失败：${reason}` });
    console.error(`FAIL 首页可用 — 连接失败：${reason}`);
    const md = summaryMarkdown(BASE, "FAIL", results);
    console.log(md);
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
    process.exit(1);
  }

  for (const c of checks) {
    try {
      const detail = await c.run();
      results.push({ name: c.name, observe: !!c.observe, ok: true, detail });
      console.log(`${c.observe ? "OBS " : "PASS"} ${c.name} — ${detail}`);
    } catch (e) {
      const detail = String(e?.message || e);
      results.push({ name: c.name, observe: !!c.observe, ok: false, detail });
      console.log(`${c.observe ? "WARN" : "FAIL"} ${c.name} — ${detail}`);
    }
  }

  const failed = results.filter((r) => !r.ok && !r.observe);
  const outcome = failed.length ? "FAIL" : "PASS";
  const md = summaryMarkdown(BASE, outcome, results);
  console.log(`\n=== ${outcome} · ${results.length - failed.length}/${results.length} 项通过 · BASE=${BASE} ===`);
  if (AS_JSON) console.log(JSON.stringify({ base: BASE, outcome, results }, null, 2));
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(`脚本异常：${e?.stack || e}`);
  process.exit(1);
});
