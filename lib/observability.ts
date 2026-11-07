// 最小可观测层：转化漏斗 + AI 爬虫访问日志。
//
// 目的（对应哥飞分享）：GA 抓不到 AI 爬虫，需要自己记录爬虫请求，
// 并观察「爬虫来过之后半小时内有没有真实用户点进来」。
//
// 实现：进程内环形缓冲 + 尽力而为的 JSONL 落盘（可写文件系统时）。
// 诚实边界：Serverless 多实例下内存不共享、文件系统只读，生产应把
// recordEvent 的 sink 换成 Vercel Log Drain / 外部日志服务；本模块保证的是
// 「本地与单实例部署下真实可查」，不声称跨实例精确统计。

import fs from "node:fs";
import path from "node:path";

export type FunnelStep =
  | "page_view"
  | "reel_start"
  | "reel_slide"
  | "checkout_click"
  | "export_csv"
  | "teacher_entry";

export type ObsEvent = {
  ts: number;
  kind: "human" | "crawler";
  /** human: 漏斗步骤；crawler: 固定 "crawler_hit" */
  step: string;
  path?: string;
  ua?: string;
  bot?: string;
  lang?: string;
  ref?: string;
};

const MAX = 4000;
const buf: ObsEvent[] = [];
let file: string | null = null;
let writable = true;

function sinkFile(): string | null {
  if (file !== null) return file;
  try {
    const dir = process.env.OBS_DATA_DIR || path.join(process.cwd(), ".data");
    fs.mkdirSync(dir, { recursive: true });
    const p = path.join(dir, "observability.jsonl");
    fs.accessSync(dir, fs.constants.W_OK);
    file = p;
  } catch {
    file = ""; // 空串表示「已探测过且不可写」，不要再重试
  }
  return file;
}

export function recordEvent(e: ObsEvent): void {
  buf.push(e);
  if (buf.length > MAX) buf.splice(0, buf.length - MAX);
  if (!writable) return;
  const p = sinkFile();
  if (!p) {
    if (p === "") writable = false;
    return;
  }
  try {
    fs.appendFileSync(p, JSON.stringify(e) + "\n");
  } catch {
    writable = false;
  }
}

/** 已知 AI / 搜索爬虫 UA。命中即记为 crawler，便于区分真人流量。 */
const BOTS: [RegExp, string][] = [
  [/GPTBot/i, "GPTBot"],
  [/OAI-SearchBot/i, "OAI-SearchBot"],
  [/ChatGPT-User/i, "ChatGPT-User"],
  [/ClaudeBot|Claude-Web|anthropic-ai/i, "ClaudeBot"],
  [/PerplexityBot/i, "PerplexityBot"],
  [/Google-Extended/i, "Google-Extended"],
  [/Googlebot/i, "Googlebot"],
  [/Bingbot/i, "Bingbot"],
  [/CCBot/i, "CCBot"],
  [/Bytespider/i, "Bytespider"],
  [/cohere-ai/i, "Cohere"],
  [/YouBot/i, "YouBot"],
  [/Applebot-Extended/i, "Applebot-Extended"],
];

export function detectBot(ua: string | null): string | null {
  if (!ua) return null;
  for (const [re, name] of BOTS) if (re.test(ua)) return name;
  return null;
}

export type ObsStats = {
  windowMinutes: number;
  totals: Record<string, number>;
  crawlerHits: number;
  humanHits: number;
  crawlerByBot: Record<string, number>;
  /** 爬虫访问后 30 分钟内出现真人访问的路径数（粗略关联，非因果证明） */
  crawlerFollowedByHuman: number;
  recent: ObsEvent[];
  storage: "memory+file" | "memory-only";
};

export function getStats(windowMinutes = 60): ObsStats {
  const cutoff = Date.now() - windowMinutes * 60_000;
  const win = buf.filter((e) => e.ts >= cutoff);
  const totals: Record<string, number> = {};
  const crawlerByBot: Record<string, number> = {};
  let crawlerHits = 0, humanHits = 0;
  for (const e of win) {
    totals[e.step] = (totals[e.step] || 0) + 1;
    if (e.kind === "crawler") {
      crawlerHits++;
      if (e.bot) crawlerByBot[e.bot] = (crawlerByBot[e.bot] || 0) + 1;
    } else humanHits++;
  }
  // 粗略关联：某路径被爬虫访问后 30 分钟内，同路径出现真人访问
  let crawlerFollowedByHuman = 0;
  const crawlerVisits = win.filter((e) => e.kind === "crawler" && e.path);
  for (const c of crawlerVisits) {
    const hit = win.some(
      (h) => h.kind === "human" && h.path === c.path && h.ts >= c.ts && h.ts - c.ts <= 30 * 60_000
    );
    if (hit) crawlerFollowedByHuman++;
  }
  return {
    windowMinutes,
    totals,
    crawlerHits,
    humanHits,
    crawlerByBot,
    crawlerFollowedByHuman,
    recent: win.slice(-40).reverse(),
    storage: writable && sinkFile() ? "memory+file" : "memory-only",
  };
}
