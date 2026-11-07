// 免费层 AI 配额护栏：防止「无限问答」把 token 烧穿。
//
// 峰会分享里 Mike 的教训：token 消耗一个半月从每天几千涨到 5 亿，
// 每月订阅费可能还不够付任务消耗。免费、无需账号的 AI 对话尤其需要硬顶。
// 这里做三件事：
//  1) 单次输入长度上限（按字符粗估 token）
//  2) 服务端强制 max_tokens，杜绝客户端指定超大输出
//  3) 每 IP 每日累计 token 估算上限 + 每分钟请求频率
//
// 诚实边界：进程内 Map 在 Serverless 多实例下不共享，仅保证单实例有效；
// 生产应换成 Redis / 外部计量。此处不声称跨实例精确计费。

export const INPUT_MAX_CHARS = 1200;
export const OUTPUT_MAX_TOKENS = 700;
export const DAILY_TOKEN_CAP = 120_000;
export const PER_MINUTE_MAX = 12;

type Ledger = {
  tokens: number;
  day: number;
  minute: number;
  minuteCount: number;
};

const ledgers = new Map<string, Ledger>();

function bucket(ts: number, ms: number) {
  return Math.floor(ts / ms);
}

/** 粗估 token（英文约 4 字符/token，中文约 1.5 字符/token，取保守值）。 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  const cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const rest = text.length - cjk;
  return Math.ceil(cjk / 1.5 + rest / 4);
}

export type QuotaState = {
  allowed: boolean;
  reason: "ok" | "input_too_long" | "rate_limited" | "daily_cap";
  tokensToday: number;
  dailyCap: number;
  minuteCount: number;
  outputMaxTokens: number;
};

export function checkQuota(ip: string, input: string, now = Date.now()): QuotaState {
  const state = ledgers.get(ip) || { tokens: 0, day: 0, minute: 0, minuteCount: 0 };
  const day = bucket(now, 86_400_000);
  const minute = bucket(now, 60_000);
  if (state.day !== day) {
    state.tokens = 0;
    state.day = day;
  }
  if (state.minute !== minute) {
    state.minuteCount = 0;
    state.minute = minute;
  }
  const base: Omit<QuotaState, "allowed" | "reason"> = {
    tokensToday: state.tokens,
    dailyCap: DAILY_TOKEN_CAP,
    minuteCount: state.minuteCount,
    outputMaxTokens: OUTPUT_MAX_TOKENS,
  };
  if (input.length > INPUT_MAX_CHARS) return { ...base, allowed: false, reason: "input_too_long" };
  if (state.minuteCount >= PER_MINUTE_MAX) return { ...base, allowed: false, reason: "rate_limited" };
  const projected = state.tokens + estimateTokens(input) + OUTPUT_MAX_TOKENS;
  if (projected > DAILY_TOKEN_CAP) return { ...base, allowed: false, reason: "daily_cap" };
  ledgers.set(ip, state);
  return { ...base, allowed: true, reason: "ok" };
}

/** 调用后记账：以实际输出长度估算，避免只按最坏值累计。 */
export function recordUsage(ip: string, input: string, output: string, now = Date.now()): QuotaState {
  const state = ledgers.get(ip) || { tokens: 0, day: 0, minute: 0, minuteCount: 0 };
  const day = bucket(now, 86_400_000);
  const minute = bucket(now, 60_000);
  if (state.day !== day) { state.tokens = 0; state.day = day; }
  if (state.minute !== minute) { state.minuteCount = 0; state.minute = minute; }
  state.minuteCount += 1;
  state.tokens += estimateTokens(input) + estimateTokens(output);
  ledgers.set(ip, state);
  return {
    allowed: true,
    reason: "ok",
    tokensToday: state.tokens,
    dailyCap: DAILY_TOKEN_CAP,
    minuteCount: state.minuteCount,
    outputMaxTokens: OUTPUT_MAX_TOKENS,
  };
}

export function quotaSnapshot(ip: string): QuotaState {
  const state = ledgers.get(ip) || { tokens: 0, day: 0, minute: 0, minuteCount: 0 };
  return {
    allowed: true, reason: "ok",
    tokensToday: state.tokens, dailyCap: DAILY_TOKEN_CAP,
    minuteCount: state.minuteCount, outputMaxTokens: OUTPUT_MAX_TOKENS,
  };
}
