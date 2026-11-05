// 会话花费闸：订阅制 SaaS 的账单护栏。
// 借鉴 God's Eye View 的 $2 警告 / $5 硬顶，另加每 IP 日限额与每分钟调用频率上限。
// 注意：这里的单价仅用于「会话内保守估算」，不是计费依据；生产环境应改为按
// provider 返回的 usage 精确记账，并把账本放进 Redis（当前进程内 Map 在 Serverless
// 下不共享，仅保证单实例有效）。

export type SpendLimits = {
  /** 单会话警告线（美元） */
  warnUsd: number;
  /** 单会话硬顶（美元），超过直接拒绝新调用 */
  hardCapUsd: number;
  /** 每 IP 每日硬顶（美元） */
  dailyCapUsd: number;
  /** 每会话每分钟最多工具调用数 */
  maxCallsPerMinute: number;
};

export const DEFAULT_LIMITS: SpendLimits = {
  warnUsd: 2,
  hardCapUsd: 5,
  dailyCapUsd: 20,
  maxCallsPerMinute: 24,
};

export type SpendState = {
  usedUsd: number;
  callsTotal: number;
  callsThisMinute: number;
  warning: boolean;
  capped: boolean;
};

// 保守估算单价（USD / 1K tokens）。仅用于护栏，务必按 provider 最新价目复核。
const RATES: Record<string, { in: number; out: number }> = {
  "gpt-4o-mini": { in: 0.00015, out: 0.0006 },
  "gpt-4o-realtime": { in: 0.005, out: 0.02 },
  default: { in: 0.001, out: 0.003 },
};

export function estimateUsd(model: string, inputTokens: number, outputTokens: number): number {
  const r = RATES[model] || RATES.default;
  return (Math.max(0, inputTokens) / 1000) * r.in + (Math.max(0, outputTokens) / 1000) * r.out;
}

type Ledger = { usedUsd: number; calls: number; minuteBucket: number; minuteCalls: number };

const blank = (): Ledger => ({ usedUsd: 0, calls: 0, minuteBucket: 0, minuteCalls: 0 });

export class SpendGuard {
  private sessions = new Map<string, Ledger>();
  private daily = new Map<string, { usedUsd: number }>();

  constructor(private limits: SpendLimits = DEFAULT_LIMITS) {}

  private minuteKey(now: number) {
    return Math.floor(now / 60_000);
  }

  /** 调用前检查：返回是否允许、是否触发警告、以及拒绝原因 */
  check(sessionKey: string, ipKey: string, estimatedUsd = 0, now = Date.now()) {
    const s = this.sessions.get(sessionKey) || blank();
    const d = this.daily.get(ipKey) || { usedUsd: 0 };
    const mk = this.minuteKey(now);
    if (s.minuteBucket !== mk) {
      s.minuteBucket = mk;
      s.minuteCalls = 0;
    }
    if (s.usedUsd >= this.limits.hardCapUsd) {
      return { allowed: false, warning: true, reason: "session_cap" as const };
    }
    if (d.usedUsd >= this.limits.dailyCapUsd) {
      return { allowed: false, warning: true, reason: "daily_cap" as const };
    }
    if (s.minuteCalls >= this.limits.maxCallsPerMinute) {
      return { allowed: false, warning: false, reason: "rate_limit" as const };
    }
    return {
      allowed: true,
      warning: s.usedUsd + estimatedUsd >= this.limits.warnUsd,
      reason: null,
    };
  }

  /** 调用后记账（应基于 provider 返回的真实 usage，无 usage 时用估算值） */
  record(sessionKey: string, ipKey: string, usd: number, now = Date.now()) {
    const s = this.sessions.get(sessionKey) || blank();
    const mk = this.minuteKey(now);
    if (s.minuteBucket !== mk) {
      s.minuteBucket = mk;
      s.minuteCalls = 0;
    }
    s.usedUsd += Math.max(0, usd);
    s.calls += 1;
    s.minuteCalls += 1;
    this.sessions.set(sessionKey, s);
    const d = this.daily.get(ipKey) || { usedUsd: 0 };
    d.usedUsd += Math.max(0, usd);
    this.daily.set(ipKey, d);
    return this.state(sessionKey);
  }

  state(sessionKey: string): SpendState {
    const s = this.sessions.get(sessionKey) || blank();
    return {
      usedUsd: Number(s.usedUsd.toFixed(4)),
      callsTotal: s.calls,
      callsThisMinute: s.minuteCalls,
      warning: s.usedUsd >= this.limits.warnUsd,
      capped: s.usedUsd >= this.limits.hardCapUsd,
    };
  }
}
