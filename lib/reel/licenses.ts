/** 许可过滤与署名：只放行可免费商用、且允许改编/展示的素材。
 *
 * 放行：Public Domain / CC0 / CC BY / CC BY-SA（含版本号、旧称、政府公有领域标记）
 * 拒绝：NC、ND、All rights reserved、fair use、非自由许可、许可证缺失/不明
 *
 * 额外拒绝（2026-11-06 URAA 复核后新增）：**来源国「已过期」型公有领域标签**。
 * 这类素材在来源国确实已进公版，但在美国可能因 17 U.S.C. §104A（URAA）恢复版权。
 * 中国 URAA 生效日为 1996-01-01，而 1990 年《著作权法》第 21 条规定摄影作品
 * 保护期为首次发表后 50 年 → 1949 年发表的照片在 1996 年时仍受保护，恢复条件成立，
 * 恢复后美国版权为「首次发表起 95 年」（约至 2044 年底）。Commons 官方规则表对
 * 1946–1953 年中国作品明确要求 {{Not-PD-US-URAA}}，并正在按「Not PD in the US」提删。
 * 因此 PD-China / PD-PRC / Not-PD-US-URAA 一类标签一律不放行，即使它写着 Public domain。
 *
 * 注意：CC BY-SA 的 share-alike 只约束「衍生作品」。本产品只做展示与实时编排，
 * 不修改素材后再分发，因此展示不触发开源义务，但**必须逐条保留署名**。
 */

export interface RawLicense {
  short?: string;
  url?: string;
  usageTerms?: string;
  copyrighted?: string;
  artist?: string;
  attributionRequired?: string;
}

export interface NormalizedLicense {
  ok: boolean;
  short: string;
  url: string;
  attributionRequired: boolean;
  reason?: string;
}

const FREE_PATTERNS = [
  /\bcc0\b|cc[ -]?zero|creative commons zero/i,
  /public domain|\bpd[- ]?(?:old|us|self|1923|1996|anon|ineligible|mark)\b|\bpd\b/i,
  /no restrictions|copyright free|free use|自由/i,
  /^cc[ -]?by(?:[ -]?sa)?(?:[ -]?\d(?:\.\d)?)?$/i,
  /creative commons attribution(?:[ -]?sharealike)?(?:[ -]?\d(?:\.\d)?)?/i,
  /^(?:nasa|noaa|us government|u\.s\. government|usgov|usgs|public domain mark)/i,
  /^(?:gfdl|gnu free documentation license)/i,
];

const BLOCK_PATTERNS = [
  /non-?commercial|\bby[ -]?nc\b|\bnc\b|noncommercial/i,
  /no[ -]?derivatives|\bby[ -]?nd\b|\bnd\b|noderivatives/i,
  /all rights reserved|copyright(?:ed)?(?:\s+work)?(?!\s*(?:public domain|pd|cc|free))/i,
  /fair use|non-?free|unfree|educational use only|personal use only/i,
  /\bcc[ -]?by[ -]?nc|\bcc[ -]?by[ -]?nd/i,
];

/** 「来源国过期型公有领域 / URAA 恢复风险」标签黑名单。
 *
 * 为什么同时检查 url：Commons 的 extmetadata 里 `LicenseShortName` 经常只写
 * "Public domain"，但 `LicenseUrl` 会指向 `Template:PD-China`；`UsageTerms` 也会带上
 * 「may have had their U.S. copyright restored under the URAA」的整段警告。
 * 只靠 short 判断会漏掉绝大多数这类文件。
 *
 * 采取保守策略：凡出现中国来源国过期型 PD 标签、`Not-PD-US-URAA`、或任何 URAA
 * 恢复提示的文件一律不放行，即使它写着 "Public domain"。`PD-China-1996` /
 * `PD-China-expired`（1945 年前已进公版）在美国其实安全，但 extmetadata 不足以
 * 可靠区分，对面向欧美的商业 SaaS 宁可少命中，也不把有争议的照片放进产品。
 */
const URAA_RISK_PATTERNS = [
  /not[- ]?pd[- ]?us[- ]?uraa/i,
  /\buraa\b|copyright restored|restored copyright|copyright restoration/i,
  /pd[- ]?(?:china|prc|roc|taiwan|manchukuo)/i,
  /template:pd[- ]?(?:china|prc|roc|taiwan|manchukuo)/i,
  /公有领域[^\n]{0,20}(?:中国|中华民国|大陆)/,
];

/** 去掉 Commons extmetadata 里 Artist 字段的 HTML 标签与实体 */
export function stripHtml(input: string): string {
  if (!input) return "";
  return input
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

export function normalizeLicense(raw: RawLicense): NormalizedLicense {
  const short = (raw.short || "").trim();
  const usage = (raw.usageTerms || "").trim();
  const copyrighted = (raw.copyrighted || "").trim().toLowerCase();
  // 许可文字用于 FREE/BLOCK 判定；许可模板 URL 额外用于 URAA 风险识别（避免误伤）。
  // 必须 trim：usage 为空时 `${short} ${usage}` 会留下尾随空格，
  // 使 `^cc by...$` 这类带 $ 锚点的白名单规则永远匹配不上，误杀 CC BY / BY-SA。
  const textHaystack = `${short} ${usage}`.trim();
  const fullHaystack = `${textHaystack} ${raw.url || ""}`.trim();

  // URAA 恢复风险优先于一切「Public domain」白名单：写着 PD 也不等于在美国自由
  if (URAA_RISK_PATTERNS.some((re) => re.test(fullHaystack))) {
    return { ok: false, short, url: raw.url || "", attributionRequired: false, reason: "uraa-restored-foreign-pd" };
  }
  if (BLOCK_PATTERNS.some((re) => re.test(textHaystack))) {
    return { ok: false, short, url: raw.url || "", attributionRequired: false, reason: "restricted-license" };
  }
  if (!short && !usage) {
    return { ok: false, short: "", url: "", attributionRequired: false, reason: "license-missing" };
  }
  if (!FREE_PATTERNS.some((re) => re.test(textHaystack))) {
    return { ok: false, short, url: raw.url || "", attributionRequired: false, reason: "license-not-free" };
  }
  // Commons 的 Copyrighted=True 常见于「作者仍保留署名」的 CC 授权图，
  // 只要许可本身在白名单就放行；但若同时没有许可名，则拒绝。
  if (copyrighted === "true" && !short) {
    return { ok: false, short, url: raw.url || "", attributionRequired: false, reason: "copyrighted-no-license" };
  }
  const required = (raw.attributionRequired || "").trim().toLowerCase() !== "false";
  return {
    ok: true,
    short: short || usage || "Public domain",
    url: raw.url || "",
    attributionRequired: required || /^cc[ -]?by/i.test(short),
  };
}

/** 生成可展示的署名行 */
export function attributionLine(info: {
  short: string;
  url: string;
  author: string;
  sourcePage: string;
  source: string;
}): string {
  const who = info.author || "Unknown author";
  const lic = info.url ? `${info.short} (${info.url})` : info.short;
  return `${who} · ${lic} · ${info.source} · ${info.sourcePage}`.trim();
}

/** 只允许这些 CDN 域名进入 manifest，避免把任意外链注入播放器（SSRF / 内容注入） */
const ALLOWED_HOSTS = [
  /^upload\.wikimedia\.org$/,
  /^commons\.wikimedia\.org$/,
  /^archive\.org$/,
  /^ia\d+\.us\.archive\.org$/,
  /^ia\d{6}\.us\.archive\.org$/,
];

export function isAllowedMediaUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    return ALLOWED_HOSTS.some((re) => re.test(u.hostname.toLowerCase()));
  } catch {
    return false;
  }
}
