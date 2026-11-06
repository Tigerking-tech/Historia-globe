/** 免费授权影像源适配器 — Wikimedia Commons / Internet Archive / Wikipedia
 *
 * 【为什么这样设计】
 *  - 全部是无需 key、可免费商用的公开 API；Vercel 部署在境外网络可直连，
 *    沙箱当前网络不可达不影响代码正确性（会返回 unreachable 报告并降级）。
 *  - 所有请求 URL 由服务端常量 + encodeURIComponent 拼装，**不接受用户传入的 URL**，
 *    从根上杜绝 SSRF；返回的素材 URL 再经 isAllowedMediaUrl 白名单校验。
 *  - 不下载、不转码、不落盘：这里只拿「元数据 + URL」，字节流由浏览器直连上游 CDN。
 *  - 逐条解析许可元数据，只放行 PD / CC0 / CC BY / CC BY-SA，并保留署名。
 */

import { isAllowedMediaUrl, normalizeLicense, stripHtml } from "./licenses";
import type {
  ReelAsset,
  ReelEventInput,
  ReelSourceName,
  SourceReport,
} from "./types";

const UA =
  "HistoriaGlobe/1.0 (https://github.com/Tigerking-tech/Historia-globe; archival reel research)";
/** 基址可用环境变量覆盖，仅用于本地模拟源做端到端验证；
 *  生产（Vercel）不设置，直连官方域名。下载基址固定，保证 host 白名单有效。 */
const COMMONS_API = process.env.REEL_COMMONS_API || "https://commons.wikimedia.org/w/api.php";
const WIKIPEDIA_API = process.env.REEL_WIKIPEDIA_API || "https://en.wikipedia.org/w/api.php";
const ARCHIVE_SEARCH = process.env.REEL_ARCHIVE_SEARCH || "https://archive.org/advancedsearch.php";
const ARCHIVE_METADATA = process.env.REEL_ARCHIVE_METADATA || "https://archive.org/metadata/";
const ARCHIVE_DOWNLOAD = "https://archive.org/download/";

const TIMEOUT_MS = 8_000;
const IA_TIMEOUT_MS = 10_000;
const MAX_TERM_LEN = 120;
const MAX_PER_SOURCE = 8;

/** 进程内短缓存：配合外层 CDN s-maxage，避免同一事件反复打上游 */
const MEMO = new Map<string, { v: unknown; ts: number }>();
const MEMO_TTL = 60 * 60 * 1000;
const MEMO_MAX = 200;

function memoGet<T>(k: string): T | undefined {
  const hit = MEMO.get(k);
  if (!hit) return undefined;
  if (Date.now() - hit.ts > MEMO_TTL) { MEMO.delete(k); return undefined; }
  return hit.v as T;
}
function memoSet(k: string, v: unknown) {
  if (MEMO.size > MEMO_MAX) MEMO.delete(MEMO.keys().next().value as string);
  MEMO.set(k, { v, ts: Date.now() });
}

async function fetchJson(url: string, ms = TIMEOUT_MS, tries = 2): Promise<any> {
  const cached = memoGet<any>(url);
  if (cached) return cached;
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": UA,
          "Api-User-Agent": UA, // Wikimedia 要求脚本自报身份，否则 403
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(ms),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      memoSet(url, json);
      return json;
    } catch (e) {
      last = e;
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}

/** 清洗检索串：去控制字符、限长，防止注入异常查询 */
export function cleanTerms(raw: string): string {
  return (raw || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[<>{}[\]^`|\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TERM_LEN);
}

/** 构造多组检索词：原词、去中文后的拉丁词、年份+地点，提升跨语言命中率 */
export function buildQueries(input: ReelEventInput): string[] {
  const bits = [input.title, input.place, input.year ? String(input.year) : ""]
    .map((s) => cleanTerms(s || ""))
    .filter(Boolean);
  const primary = cleanTerms(bits.join(" "));
  const latin = cleanTerms(
    bits
      .map((s) => s.replace(/[\u4e00-\u9fff\u3000-\u303f]/g, " ").trim())
      .filter(Boolean)
      .join(" "),
  );
  const compact = cleanTerms(
    [input.title, input.year ? String(input.year) : ""].filter(Boolean).join(" "),
  );
  const out: string[] = [];
  for (const q of [primary, latin, compact]) {
    if (q && q.length >= 2 && !out.includes(q)) out.push(q);
  }
  return out.slice(0, 3);
}

function report(name: ReelSourceName, status: SourceReport["status"], t0: number, count?: number, detail?: string): SourceReport {
  return { name, status, count, ms: Math.round(performance.now() - t0), detail };
}

/** 从 Commons extmetadata 取字段值 */
function meta(em: Record<string, { value?: string } | undefined>, key: string): string {
  return String(em?.[key]?.value ?? "");
}

/** Wikimedia Commons 检索（图片或视频） */
export async function searchCommons(
  query: string,
  kind: "image" | "video",
): Promise<{ assets: ReelAsset[]; sources: SourceReport[] }> {
  const t0 = performance.now();
  const name: ReelSourceName = kind === "video" ? "commons-video" : "commons-image";
  const gsr = `${query} ${kind === "video" ? "filetype:video" : "filetype:bitmap"}`;
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    generator: "search",
    gsrnamespace: "6",
    gsrlimit: "12",
    gsrsearch: gsr,
    prop: "imageinfo",
    iiprop: "url|size|mime|extmetadata",
    iiurlwidth: "1280",
    iiextmetadatafilter:
      "LicenseShortName|LicenseUrl|UsageTerms|Artist|Copyrighted|AttributionRequired|ImageDescription|DateTimeOriginal",
  });
  let json: any;
  try {
    json = await fetchJson(`${COMMONS_API}?${params.toString()}`);
  } catch (e) {
    return { assets: [], sources: [report(name, "unreachable", t0, 0, (e as Error).message)] };
  }
  const pages: any[] = (json?.query?.pages || []).slice();
  pages.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

  const assets: ReelAsset[] = [];
  let filtered = 0;
  for (const p of pages) {
    if (assets.length >= MAX_PER_SOURCE) break;
    const ii = p.imageinfo?.[0];
    if (!ii || !ii.url) continue;
    const mime = String(ii.mime || "");
    const isVideo = /^video\//.test(mime) || /\.(webm|ogv|mp4|mpeg|mpg)$/i.test(ii.url);
    const isImage = /^image\/(jpeg|png|webp|jpg|gif)$/i.test(mime) || /\.(jpe?g|png|webp|gif)$/i.test(ii.url);
    if (kind === "video" ? !isVideo : !isImage) continue;

    const em = ii.extmetadata || {};
    const lic = normalizeLicense({
      short: meta(em, "LicenseShortName"),
      url: meta(em, "LicenseUrl"),
      usageTerms: meta(em, "UsageTerms"),
      copyrighted: meta(em, "Copyrighted"),
      artist: stripHtml(meta(em, "Artist")),
      attributionRequired: meta(em, "AttributionRequired"),
    });
    if (!lic.ok) { filtered++; continue; }

    const url = kind === "video" ? ii.url : ii.thumburl || ii.url;
    const poster = ii.thumburl || (kind === "image" ? ii.url : undefined);
    if (!isAllowedMediaUrl(url)) { filtered++; continue; }

    const idx = pages.indexOf(p);
    assets.push({
      kind,
      url,
      posterUrl: poster && isAllowedMediaUrl(poster) ? poster : undefined,
      width: Number(ii.width) || undefined,
      height: Number(ii.height) || undefined,
      title: stripHtml(String(p.title || "").replace(/^File:/, "")),
      license: {
        short: lic.short,
        url: lic.url,
        author: stripHtml(meta(em, "Artist")) || "Wikimedia Commons contributor",
        attributionRequired: lic.attributionRequired,
        sourcePage: `https://commons.wikimedia.org/wiki/${encodeURIComponent(String(p.title || ""))}`,
        source: name,
      },
      score: 10 - idx + (Number(ii.width) > 1600 ? 1 : 0),
    });
  }
  const status: SourceReport["status"] = assets.length ? "ok" : filtered ? "filtered" : "empty";
  return {
    assets,
    sources: [report(name, status, t0, assets.length, filtered ? `license-filtered=${filtered}` : undefined)],
  };
}

/** Internet Archive 公版/CC 历史影片：advancedsearch → metadata → 可播放 mp4 */
export async function searchArchive(
  query: string,
): Promise<{ assets: ReelAsset[]; sources: SourceReport[] }> {
  const t0 = performance.now();
  const words = cleanTerms(query)
    .replace(/[^0-9A-Za-z\u4e00-\u9fff\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1)
    .slice(0, 6);
  if (!words.length) return { assets: [], sources: [report("archive", "empty", t0, 0)] };

  const lucene = `(${words.map((w) => `title:${w}`).join(" OR ")}) AND mediatype:movies`;
  const params = new URLSearchParams({ q: lucene, rows: "6", page: "1", output: "json" });
  for (const f of ["identifier", "title", "year", "licenseurl", "rights", "description"]) params.append("fl[]", f);
  params.append("sort[]", "downloads desc");

  let docs: any[];
  try {
    const json = await fetchJson(`${ARCHIVE_SEARCH}?${params.toString()}`, IA_TIMEOUT_MS);
    docs = json?.response?.docs || [];
  } catch (e) {
    return { assets: [], sources: [report("archive", "unreachable", t0, 0, (e as Error).message)] };
  }
  if (!docs.length) return { assets: [], sources: [report("archive", "empty", t0, 0)] };

  // 只接受明确标注 Public Domain / CC BY / CC0 的条目，避免误用版权不明的上传
  const licensed = docs.filter((d) => {
    const s = `${d.licenseurl || ""} ${d.rights || ""}`;
    return /creativecommons\.org\/(?:licenses\/(?:by|by-sa)|publicdomain\/zero)|publicdomain\.org|public domain|\bcc0\b/i.test(s);
  });
  if (!licensed.length) {
    return { assets: [], sources: [report("archive", "filtered", t0, 0, "no explicit free license")] };
  }

  const settled = await Promise.allSettled(
    licensed.slice(0, 3).map(async (d) => {
      const id = String(d.identifier || "");
      if (!/^[A-Za-z0-9._-]+$/.test(id)) return null;
      const json = await fetchJson(`${ARCHIVE_METADATA}${id}`, IA_TIMEOUT_MS, 1);
      const files: any[] = json?.files || [];
      const mp4s = files
        .filter((f) => /\.mp4$/i.test(String(f.name || "")) && Number(f.size || 0) > 0 && Number(f.size) < 200_000_000)
        .sort((a, b) => {
          const rank = (f: any) => (/h\.?264|mpeg4|mp4/i.test(String(f.format || "")) ? 2 : 1);
          return rank(b) - rank(a);
        });
      const f = mp4s[0];
      if (!f) return null;
      const url = `${ARCHIVE_DOWNLOAD}${id}/${encodeURIComponent(String(f.name))}`;
      if (!isAllowedMediaUrl(url)) return null;
      const licUrl = String(d.licenseurl || "");
      return {
        kind: "video" as const,
        url,
        title: String(d.title || id),
        license: {
          short: /creativecommons/i.test(licUrl) ? "CC BY / BY-SA" : "Public Domain",
          url: licUrl,
          author: String(d.creator || d.title || "Internet Archive"),
          attributionRequired: /creativecommons/i.test(licUrl),
          sourcePage: `https://archive.org/details/${id}`,
          source: "archive" as const,
        },
        score: 8,
      } satisfies ReelAsset;
    }),
  );
  const assets: ReelAsset[] = [];
  for (const r of settled) {
    if (r.status === "fulfilled" && r.value) assets.push(r.value);
  }

  return {
    assets,
    sources: [report("archive", assets.length ? "ok" : "empty", t0, assets.length)],
  };
}

/** 英文维基摘要：只用于把中文/口语化事件名解析成更规范的检索词与字幕，不取图片 */
export async function resolveWikipediaTitle(query: string): Promise<{ title: string; extract: string; sources: SourceReport[] }> {
  const t0 = performance.now();
  const params = new URLSearchParams({
    action: "query", format: "json", formatversion: "2",
    list: "search", srsearch: cleanTerms(query), srlimit: "1",
  });
  try {
    const json = await fetchJson(`${WIKIPEDIA_API}?${params.toString()}`);
    const hit = json?.query?.search?.[0];
    if (!hit) return { title: "", extract: "", sources: [report("wikipedia", "empty", t0, 0)] };
    return {
      title: String(hit.title || ""),
      extract: stripHtml(String(hit.snippet || "")),
      sources: [report("wikipedia", "ok", t0, 1)],
    };
  } catch (e) {
    return { title: "", extract: "", sources: [report("wikipedia", "unreachable", t0, 0, (e as Error).message)] };
  }
}

/** 一次性探测各源可达性（?debug=1 用），便于上线前确认 Vercel 出网正常 */
export async function probeSources(): Promise<SourceReport[]> {
  const checks: [ReelSourceName, string][] = [
    ["commons-image", `${COMMONS_API}?action=query&format=json&formatversion=2&meta=siteinfo`],
    ["wikipedia", `${WIKIPEDIA_API}?action=query&format=json&formatversion=2&meta=siteinfo`],
    ["archive", `${ARCHIVE_SEARCH}?q=mediatype%3Amovies&rows=1&output=json`],
  ];
  const out = await Promise.all(
    checks.map(async ([name, url]) => {
      const t0 = performance.now();
      try { await fetchJson(url, 6_000, 1); return report(name, "ok", t0); }
      catch (e) { return report(name, "unreachable", t0, 0, (e as Error).message); }
    }),
  );
  return out;
}
