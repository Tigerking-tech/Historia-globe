/** 免费授权图片源适配器 — Wikimedia Commons / Wikipedia
 *
 * 全站统一「照片幻灯片」后，这里只做一件事：按事件检索**自由授权的真实照片**。
 * 不再检索视频 / 影片：Commons 上视频仅约 0.25% 且不支持 MP4/H.264，
 * 历史活动的连续影像基本都有版权，不是可自由商用的素材。
 *
 * 设计：
 *  - 全部是无需 key、可免费商用的公开 API；Vercel 部署在境外网络可直连，
 *    沙箱当前网络不可达不影响代码正确性（返回 unreachable 报告并优雅降级）。
 *  - 请求 URL 由服务端常量 + encodeURIComponent 拼装，**不接受用户传入的 URL**，
 *    杜绝 SSRF；返回的素材 URL 再经 isAllowedMediaUrl 白名单校验。
 *  - 不下载、不转码、不落盘：只拿「元数据 + URL」，字节流由浏览器直连上游 CDN。
 *  - 逐条解析许可元数据，只放行 PD / CC0 / CC BY / CC BY-SA，并保留署名。
 */

import { isAllowedMediaUrl, normalizeLicense, stripHtml } from "./licenses";
import type {
  LicenseInfo,
  ReelEventInput,
  ReelSourceName,
  SourceReport,
} from "./types";

const UA =
  "HistoriaGlobe/1.0 (https://github.com/Tigerking-tech/Historia-globe; archival slideshow research)";
/** 基址可用环境变量覆盖，仅用于本地模拟源做端到端验证；
 *  生产（Vercel）不设置，直连官方域名。 */
const COMMONS_API = process.env.REEL_COMMONS_API || "https://commons.wikimedia.org/w/api.php";
const WIKIPEDIA_API = process.env.REEL_WIKIPEDIA_API || "https://en.wikipedia.org/w/api.php";

/** 单次上游请求超时。Wikimedia API 正常响应通常 < 1s；4s 足够覆盖真实网络抖动，
 *  又不会让受限网络（沙箱）下的首屏等待翻倍到十几秒。超时不重试，见 fetchJson。*/
const TIMEOUT_MS = 4_000;
const MAX_TERM_LEN = 120;
const MAX_PER_SOURCE = 10;

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
      // 上游整体不可达（受限网络 / DNS 不通）时，每个请求都会等满超时；
      // 若再重试一次，首屏等待会线性翻倍（实测 8s×2 ≈ 16s）。超时直接快速失败，
      // 播放器立刻显示诚实占位；仅对 HTTP 5xx 等可恢复异常保留一次重试。
      const name = e instanceof Error ? e.name : "";
      if (name === "TimeoutError" || name === "AbortError") break;
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

function meta(em: Record<string, { value?: string } | undefined>, key: string): string {
  return String(em?.[key]?.value ?? "");
}

/** 检索到的一张自由授权照片（尚未组装成幻灯片） */
export interface FoundImage {
  url: string;
  title: string;
  note: string;
  width?: number;
  height?: number;
  license: LicenseInfo;
}

/** Wikimedia Commons 图片检索 */
export async function searchCommonsImages(
  query: string,
): Promise<{ images: FoundImage[]; sources: SourceReport[] }> {
  const t0 = performance.now();
  const gsr = `${query} filetype:bitmap`;
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    generator: "search",
    gsrnamespace: "6",
    gsrlimit: "16",
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
    return { images: [], sources: [report("commons-image", "unreachable", t0, 0, (e as Error).message)] };
  }
  const pages: any[] = (json?.query?.pages || []).slice();
  pages.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

  const images: FoundImage[] = [];
  let filtered = 0;
  let uraa = 0;
  for (const p of pages) {
    if (images.length >= MAX_PER_SOURCE) break;
    const ii = p.imageinfo?.[0];
    if (!ii || !ii.url) continue;
    const mime = String(ii.mime || "");
    const isImage = /^image\/(jpeg|png|webp|jpg)$/i.test(mime) || /\.(jpe?g|png|webp)$/i.test(ii.url);
    if (!isImage) continue;

    const em = ii.extmetadata || {};
    const lic = normalizeLicense({
      short: meta(em, "LicenseShortName"),
      url: meta(em, "LicenseUrl"),
      usageTerms: meta(em, "UsageTerms"),
      copyrighted: meta(em, "Copyrighted"),
      artist: stripHtml(meta(em, "Artist")),
      attributionRequired: meta(em, "AttributionRequired"),
    });
    if (!lic.ok) {
      if (lic.reason === "uraa-restored-foreign-pd") uraa++; else filtered++;
      continue;
    }

    const url = ii.thumburl || ii.url;
    if (!isAllowedMediaUrl(url)) { filtered++; continue; }

    const date = stripHtml(meta(em, "DateTimeOriginal")).slice(0, 24);
    images.push({
      url,
      title: stripHtml(String(p.title || "").replace(/^File:/, "")).replace(/\.(jpe?g|png|webp)$/i, "").slice(0, 60),
      note: date || stripHtml(meta(em, "ImageDescription")).slice(0, 60),
      width: Number(ii.width) || undefined,
      height: Number(ii.height) || undefined,
      license: {
        short: lic.short,
        url: lic.url,
        author: stripHtml(meta(em, "Artist")) || "Wikimedia Commons contributor",
        attributionRequired: lic.attributionRequired,
        sourcePage: `https://commons.wikimedia.org/wiki/${encodeURIComponent(String(p.title || ""))}`,
        source: "commons-image",
      },
    });
  }
  const status: SourceReport["status"] = images.length ? "ok" : (filtered || uraa) ? "filtered" : "empty";
  const detail = [filtered ? `license-filtered=${filtered}` : "", uraa ? `uraa-filtered=${uraa}` : ""].filter(Boolean).join(" ") || undefined;
  return {
    images,
    sources: [report("commons-image", status, t0, images.length, detail)],
  };
}

/** 英文维基摘要：把中文/口语化事件名解析成更规范的检索词，不取图片 */
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
  ];
  return Promise.all(
    checks.map(async ([name, url]) => {
      const t0 = performance.now();
      try { await fetchJson(url, 6_000, 1); return report(name, "ok", t0); }
      catch (e) { return report(name, "unreachable", t0, 0, (e as Error).message); }
    }),
  );
}
