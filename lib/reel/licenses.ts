/** 许可过滤与署名：只放行可免费商用、且允许改编/展示的素材。
 *
 * 放行：Public Domain / CC0 / CC BY / CC BY-SA（含版本号、旧称、政府公有领域标记）
 * 拒绝：NC、ND、All rights reserved、fair use、非自由许可、以及许可证缺失/不明
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
  const haystack = `${short} ${usage}`;

  if (BLOCK_PATTERNS.some((re) => re.test(haystack))) {
    return { ok: false, short, url: raw.url || "", attributionRequired: false, reason: "restricted-license" };
  }
  if (!short && !usage) {
    return { ok: false, short: "", url: "", attributionRequired: false, reason: "license-missing" };
  }
  if (!FREE_PATTERNS.some((re) => re.test(haystack))) {
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
