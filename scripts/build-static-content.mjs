#!/usr/bin/env node
// 构建期静态内容补齐：把 Wikipedia「On this day」按 366 个日历日抓成仓库内 JSON，
// 让静态内容页不再只有 150 条本地策展事件，且完全不依赖运行时外网。
//
// 本脚本零第三方依赖（只用 Node 内置模块），因此 CI 里不需要 npm install。
//
// 设计约束（与项目「诚实」原则一致）：
//  1) 纯确定性映射，不经过任何 AI 推断；每条带可点击的真实来源 URL。
//  2) 幂等：数据未变化则一个字节都不写，避免 CI 每次产生空 diff / 空提交 / 无意义部署。
//  3) 失败零回归：上游不可达、或抓到的条目全部被丢弃时，完全不碰已有快照文件。
//  4) 仓库内快照不含时间戳等易变字段；运行统计只写入 stdout 与 GitHub Step Summary。
//  5) 不生成坐标 / 地点 / 类别：Wikipedia feed 没有经纬度，凭空补齐会破坏地球 pin 层。
//     产出只用于日期页文本补充，不生成事件页 / 地点页，也不进入地球点位。
//
// 用法：
//   node scripts/build-static-content.mjs                      # 真实抓取，写 data/generated-events.json
//   node scripts/build-static-content.mjs --ci                # GitHub Actions 模式（写 Step Summary）
//   node scripts/build-static-content.mjs --self-test         # 只跑纯函数单测，不联网
//   node scripts/build-static-content.mjs --fixture=ok --out /tmp/a.json   # 不联网，模拟成功抓取
//   node scripts/build-static-content.mjs --fixture=fail --out /tmp/b.json # 不联网，模拟上游失败
//
// 退出码：0 = 数据可用且已写入/本就一致；1 = 无数据可用但已保留旧快照（非致命）；
//         2 = 部分日期失败但已写入 partial 快照；3 = 脚本自身异常。

import { readFile, writeFile, appendFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUT = path.join(ROOT, "data", "generated-events.json");
const FEED = "https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/all";
const TIMEOUT_MS = 8000;
const CONCURRENCY = 8;
const RETRIES = 1;
// 已尝试 >= 8 天且一天都没成功 → 判定上游整体不可达，提前熔断，别浪费 366 次超时。
const CIRCUIT_BREAKER_AFTER = 8;
const UA = "HistoriaGlobe/1.0 (static content build; contact hello@historiaglobe.com)";

const argv = process.argv.slice(2);
const CI = argv.includes("--ci");
const SELF_TEST = argv.includes("--self-test");
const fixtureArg = argv.find((a) => a.startsWith("--fixture="));
const FIXTURE = fixtureArg ? fixtureArg.slice("--fixture=".length) : null;
const outIdx = argv.indexOf("--out");
if (outIdx >= 0 && (!argv[outIdx + 1] || argv[outIdx + 1].startsWith("--"))) {
  console.error("[build-static-content] --out 需要一个输出路径");
  process.exit(3);
}
const OUT = outIdx >= 0 ? path.resolve(argv[outIdx + 1]) : DEFAULT_OUT;
if (FIXTURE && FIXTURE !== "ok" && FIXTURE !== "fail") {
  console.error("[build-static-content] --fixture 只接受 ok | fail");
  process.exit(3);
}

/** 366 个日历日（含 2 月 29 日）。纯函数，可单测。 */
export function calendarDays() {
  const days = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const out = [];
  for (let m = 1; m <= 12; m++) {
    for (let d = 1; d <= days[m - 1]; d++) {
      out.push({ m, d, mm: String(m).padStart(2, "0"), dd: String(d).padStart(2, "0") });
    }
  }
  return out;
}

/** 把 feed 里的一条 event 归一化。纯函数：非法输入一律返回 null，不猜、不补。 */
export function normalizeEvent(raw, m, d) {
  if (!raw || typeof raw !== "object") return null;
  const title = typeof raw.text === "string" ? raw.text.trim() : "";
  const description = typeof raw.description === "string" ? raw.description.trim() : "";
  const year = Number(raw.year);
  if (!title || !Number.isFinite(year) || year < -4000 || year > 2100) return null;

  const page = Array.isArray(raw.pages) ? raw.pages[0] : null;
  const sourceUrl =
    (page && typeof page.content_urls?.desktop?.page === "string" && page.content_urls.desktop.page) ||
    (page && typeof page.titles?.normalized === "string"
      ? `https://en.wikipedia.org/wiki/${encodeURIComponent(page.titles.normalized.replace(/ /g, "_"))}`
      : null);
  if (!sourceUrl) return null;

  return {
    m,
    d,
    year: Math.trunc(year),
    title: title.slice(0, 240),
    description: description.slice(0, 600),
    sourceUrl,
  };
}

/**
 * 仓库内快照的固定结构。刻意不含 generatedAt / daysSucceeded 等易变字段：
 * 只要事件数据不变，序列化结果就逐字节相同，CI 不会产生空提交。
 */
export function buildPayload(events, status) {
  return {
    schemaVersion: 1,
    source: FEED,
    status,
    caveat:
      "本数据集只用于静态日期页的文本补充：条目没有经纬度，不生成事件页/地点页，也不进入地球点位层。",
    eventCount: events.length,
    daysWithEvents: new Set(events.map((x) => `${x.m}-${x.d}`)).size,
    events,
  };
}

export function serialize(payload) {
  return JSON.stringify(payload, null, 2) + "\n";
}

/** 纯函数单测：验证天数、非法输入、字段裁剪、来源 URL、快照结构与确定性。 */
export function selfTest() {
  assert.equal(calendarDays().length, 366, "必须覆盖 366 个日历日");
  assert.equal(calendarDays().filter((x) => x.m === 2 && x.d === 29).length, 1, "含闰日");
  assert.equal(normalizeEvent(null, 1, 1), null);
  assert.equal(normalizeEvent({ text: "", year: 1969 }, 1, 1), null);
  assert.equal(normalizeEvent({ text: "X", year: "not-a-year" }, 1, 1), null);
  assert.equal(normalizeEvent({ text: "X", year: 1969 }, 1, 1), null, "无来源 URL 时丢弃");
  const ok = normalizeEvent(
    {
      text: "Apollo 11 lands",
      description: "First crewed Moon landing.",
      year: 1969,
      pages: [{ content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Apollo_11" } } }],
    },
    7,
    20,
  );
  assert.ok(ok, "合法条目应保留");
  assert.equal(ok.m, 7);
  assert.equal(ok.d, 20);
  assert.equal(ok.year, 1969);
  assert.equal(ok.sourceUrl, "https://en.wikipedia.org/wiki/Apollo_11");
  assert.ok(normalizeEvent({ text: "A".repeat(500), year: 1, pages: [{ titles: { normalized: "A B" } }] }, 1, 1));

  const p = buildPayload(
    [{ m: 7, d: 20, year: 1969, title: "A", description: "", sourceUrl: "https://example.org/a" }],
    "ok",
  );
  assert.equal(p.schemaVersion, 1);
  assert.equal(p.eventCount, 1);
  assert.equal(p.daysWithEvents, 1);
  assert.ok(!("generatedAt" in p), "仓库快照不得含时间戳，否则每次 CI 都产生空 diff");
  assert.equal(serialize(p), serialize(p), "序列化必须确定性");
  console.log("self-test: 16 项断言全部通过");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchDay({ mm, dd }, attempt = 0) {
  const url = `${FEED}/${mm}/${dd}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const list = Array.isArray(json?.events) ? json.events : [];
    return { mm, dd, list };
  } catch (e) {
    // 超时与 429/5xx 值得重试一次；4xx（除 429）直接判失败。
    const retryable =
      e.name === "TimeoutError" || /HTTP (429|5\d\d)/.test(e.message) || /fetch failed|network/i.test(e.message);
    if (retryable && attempt < RETRIES) {
      await sleep(400 * (attempt + 1));
      return fetchDay({ mm, dd }, attempt + 1);
    }
    throw e;
  }
}

/** 不联网的 fixture：造 366 天各 1 条合法 raw，用于验证写入/幂等逻辑。 */
function fixtureDay({ mm, dd }) {
  return {
    mm,
    dd,
    list: [
      {
        text: `Fixture event for ${mm}-${dd}`,
        description: "Offline test data, never committed.",
        year: 1969,
        pages: [
          {
            content_urls: {
              desktop: { page: `https://en.wikipedia.org/wiki/Fixture_${mm}_${dd}` },
            },
          },
        ],
      },
    ],
  };
}

async function ciSummary(lines) {
  for (const line of lines) console.log(`[build-static-content] ${line}`);
  if (!CI) return;
  const p = process.env.GITHUB_STEP_SUMMARY;
  if (!p) return;
  const md = [
    "## Wikimedia On this day 抓取结果",
    "",
    "| 项 | 值 |",
    "| --- | --- |",
    ...lines.map((l) => {
      const s = l.replace(/^\[[^\]]+\]\s*/, "");
      const i = s.indexOf(" = ");
      if (i < 0) return `| 结果 | ${s.replace(/\|/g, "\\|")} |`;
      return `| ${s.slice(0, i).replace(/\|/g, "\\|")} | ${s.slice(i + 3).replace(/\|/g, "\\|")} |`;
    }),
    "",
  ];
  await appendFile(p, md.join("\n") + "\n", "utf8").catch(() => {});
}

async function main() {
  if (SELF_TEST) {
    selfTest();
    return 0;
  }

  const days = calendarDays();
  let existingText = null;
  try {
    existingText = await readFile(OUT, "utf8");
  } catch {
    existingText = null;
  }
  const existingCount = (() => {
    if (!existingText) return 0;
    try {
      const d = JSON.parse(existingText);
      return Array.isArray(d?.events) ? d.events.length : 0;
    } catch {
      return 0;
    }
  })();

  // 1) 先探一天：上游整体不可达时快速失败，避免 366 次超时空等。
  //    关键：失败分支完全不写文件，保持仓库快照原样。
  try {
    if (FIXTURE === "fail") throw new Error("fixture: simulated upstream failure");
    if (!FIXTURE) await fetchDay(days[0]);
  } catch (e) {
    await ciSummary([
      `status = unavailable`,
      `reason = 上游探测失败：${e.name}: ${e.message}`,
      `已有事件 = ${existingCount}（未改动，快照文件保持原样）`,
      `结论 = 本次跳过；请在能访问 Wikimedia 的环境重跑`,
    ]);
    console.log(`[build-static-content] 上游不可达，保留已有 ${existingCount} 条，未写入任何文件。`);
    if (CI) console.log("::warning::Wikimedia 上游不可达，本次未更新数据（旧快照已保留）");
    return 1;
  }

  // 2) 并发抓取 366 天；带熔断，避免 CI 分钟被整体失败吃掉。
  const results = new Array(days.length);
  let cursor = 0;
  let aborted = false;
  async function worker() {
    while (!aborted && cursor < days.length) {
      const i = cursor++;
      try {
        results[i] = FIXTURE ? fixtureDay(days[i]) : await fetchDay(days[i]);
      } catch {
        results[i] = null;
      }
      const attempted = cursor;
      const succeeded = results.slice(0, attempted).filter(Boolean).length;
      if (attempted >= CIRCUIT_BREAKER_AFTER && succeeded === 0) aborted = true;
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const succeededResults = results.filter(Boolean);
  const failed = days.length - succeededResults.length;

  // 3) 归一化：保持 results 的索引顺序，保证逐次运行结果确定性。
  const events = [];
  const seen = new Set();
  for (const r of succeededResults) {
    const day = days.find((x) => x.mm === r.mm && x.dd === r.dd);
    if (!day) continue;
    for (const raw of r.list) {
      const e = normalizeEvent(raw, day.m, day.d);
      if (!e) continue;
      const key = `${e.m}-${e.d}-${e.year}-${e.title}`;
      if (seen.has(key)) continue;
      seen.add(key);
      events.push(e);
    }
  }

  if (events.length === 0) {
    await ciSummary([
      `status = unavailable`,
      `reason = 成功抓取 ${succeededResults.length} 天，但归一化后没有任何带出处的条目`,
      `已有事件 = ${existingCount}（未改动）`,
      `结论 = 拒绝用空数据覆盖已有快照`,
    ]);
    console.log("[build-static-content] 归一化后无有效条目，拒绝写入空数据。");
    if (CI) console.log("::warning::抓取结果无有效条目，已拒绝覆盖已有快照");
    return 1;
  }

  // 4) 幂等写入：内容逐字节相同就完全不碰文件。
  const payload = buildPayload(events, failed === 0 ? "ok" : "partial");
  const text = serialize(payload);
  let wrote = false;
  if (text !== existingText) {
    await mkdir(path.dirname(OUT), { recursive: true });
    await writeFile(OUT, text, "utf8");
    wrote = true;
  }

  const lines = [
    `status = ${payload.status}`,
    `成功天数 = ${succeededResults.length}/366`,
    `失败天数 = ${failed}`,
    `事件条数 = ${events.length}`,
    `覆盖日期 = ${payload.daysWithEvents}/366`,
    `快照写入 = ${wrote ? "是（数据有变化）" : "否（与仓库现有快照一致）"}`,
    `熔断 = ${aborted ? "触发（上游整体不可达，提前中止）" : "未触发"}`,
  ];
  await ciSummary(lines);
  console.log(
    `[build-static-content] status=${payload.status} 成功 ${succeededResults.length}/366 天，` +
      `失败 ${failed} 天，事件 ${events.length} 条，覆盖 ${payload.daysWithEvents} 天，` +
      `${wrote ? "已写入" : "无变化未写入"} → ${OUT}`,
  );
  if (CI && failed > 0) console.log(`::warning::有 ${failed} 天抓取失败，已写入 partial 快照（不覆盖已有好数据）`);
  return failed === 0 ? 0 : 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // --soft-fail 供 Vercel 构建期使用：上游波动或 partial 不应让整次部署失败，
  // 此时保留仓库里的旧快照，页面自动退回当前内容，零回归。
  const softFail = argv.includes("--soft-fail");
  main()
    .then((code) => process.exit(softFail && (code === 1 || code === 2) ? 0 : code))
    .catch((e) => {
      console.error("[build-static-content] 未预期错误：", e);
      process.exit(3);
    });
}
