/** 事件 → 照片幻灯片清单（ReelManifest）
 *
 * 全站统一「照片幻灯片」：**不生成视频、不存视频、不做三镜时间轴、不做 Ken Burns 运镜**。
 * 服务端只把「事件」翻译成一份很小的 JSON：一组自由授权真实照片 + 逐张署名 +
 * 轮换节奏 + 素材性质标注。素材字节流由浏览器直连上游 CDN（或同源缓存）。
 * 因此 N 个事件的成本 = N 份小 JSON + 按需图片，不存在 N 个视频文件。
 *
 * 数据来源（统一走同一套幻灯片渲染器，风格一致）：
 *   1. 本地已核验策展集（1949 / 911）—— 任何网络下都能播真实史料照片；
 *   2. 在线检索 Wikimedia Commons 自由授权图片（Vercel 境外直连自动生效）；
 *   3. 都拿不到 → mode:"empty" 诚实占位，仍用同一套幻灯片容器，绝不用矢量示意或照片配运镜冒充史料。
 *
 * 许可：只放行 PD / CC0 / CC BY / CC BY-SA（在 sources.ts 逐条解析过滤），
 * 逐张保留署名。项目内不再包含任何「需要另行取得商用授权」的素材。
 */

import { attributionLine } from "./licenses";
import { CURATED_SETS, curatedEventOverride, matchCuratedSet } from "./curated-slides";
import type { CuratedSet } from "./curated-slides";
import {
  buildQueries,
  cleanTerms,
  resolveWikipediaTitle,
  searchCommonsImages,
} from "./sources";
import type { FoundImage } from "./sources";
import type {
  LicenseInfo,
  ReelEventInput,
  ReelManifest,
  ReelSlide,
  SourceReport,
} from "./types";

/** 每张照片停留时长（毫秒） */
export const SLIDE_MS = 3600;
/** 在线检索最多取多少张 */
const MAX_SLIDES = 8;

function clampNum(v: unknown, min: number, max: number): number | null {
  const n = Number(v);
  return Number.isFinite(n) && v !== null && v !== "" ? Math.min(max, Math.max(min, n)) : null;
}

function normalizeInput(input: ReelEventInput): ReelEventInput {
  return {
    q: cleanTerms(input.q || ""),
    eventId: cleanTerms(input.eventId || "").slice(0, 80),
    title: cleanTerms(input.title || ""),
    year: clampNum(input.year, -4000, 2100) ?? undefined,
    place: cleanTerms(input.place || ""),
    category: cleanTerms(input.category || ""),
    lat: clampNum(input.lat, -90, 90),
    lon: clampNum(input.lon, -180, 180),
    lang: input.lang === "en" ? "en" : "zh",
    month: clampNum(input.month, 1, 12) ?? undefined,
    day: clampNum(input.day, 1, 31) ?? undefined,
  };
}

/** 缓存键会被写进 X-Reel-Key 响应头，而 HTTP 头只接受 ByteString（Latin-1）。
 *  中文查询词（如「世贸中心」）若原样写入，NextResponse.json 会抛
 *  "Cannot convert argument to a ByteString ... value 19990"，被路由 catch 吞掉后
 *  整页错误降级成 mode:"empty"。这里统一百分号编码，保证 key 永远 ASCII 安全。*/
function makeKey(e: ReelEventInput): string {
  const raw = `${(e.eventId || e.title || e.q || "unknown").toLowerCase().replace(/\s+/g, "-")}|${e.year ?? "na"}|${e.lang}`;
  return encodeURIComponent(raw).slice(0, 120);
}

function captionFor(img: FoundImage | { license: LicenseInfo }): string {
  const l = img.license;
  return attributionLine({
    short: l.short,
    url: l.url,
    author: l.author,
    sourcePage: l.sourcePage,
    source: l.source,
  });
}

function disclosureFor(zh: boolean, offline: boolean): { disclosure: string; badge: string } {
  if (offline) {
    return zh
      ? { disclosure: "维基共享资源公有领域真实史料照片 · 幻灯片轮换 · 逐张署名 · 非活动影像", badge: "真实史料照片 · 幻灯片" }
      : { disclosure: "Public-domain archival photos from Wikimedia Commons · slideshow · credits per slide · NOT moving footage", badge: "Archival photos · slideshow" };
  }
  return zh
    ? { disclosure: "Wikimedia Commons 自由授权史料照片 · 幻灯片轮换 · 逐条解析许可并保留署名 · 非活动影像", badge: "自由授权史料照片 · 幻灯片" }
    : { disclosure: "Freely licensed archival photos from Wikimedia Commons · slideshow · per-image license check & credits · NOT moving footage", badge: "Licensed photos · slideshow" };
}

function emptyCopy(zh: boolean): { disclosure: string; badge: string } {
  return zh
    ? { disclosure: "当前网络未检索到该事件的自由授权史料照片 · 上线（境外直连）后自动检索并轮换 · 非历史影像", badge: "暂无可用照片 · 非历史影像" }
    : { disclosure: "No freely licensed archival photo found on this network · auto-retry in production · NOT historical imagery", badge: "No photo yet · not historical" };
}

function eventOf(e: ReelEventInput, override?: ReturnType<typeof curatedEventOverride>, zh?: boolean) {
  const base = {
    title: e.title || e.q || (zh ? "历史事件" : "Historical event"),
    year: e.year ?? null,
    place: e.place || "",
    category: e.category || "",
    lat: e.lat ?? null,
    lon: e.lon ?? null,
    lang: (e.lang || "zh") as "zh" | "en",
  };
  return override ? { ...base, ...override, lang: base.lang } : base;
}

/** 上游整体异常时的兜底：完全不访问网络，仍返回同一套「空幻灯片」结构 */
export function emptyFallback(raw: ReelEventInput, reason: string): ReelManifest {
  const e = normalizeInput(raw);
  const zh = e.lang !== "en";
  const { disclosure, badge } = emptyCopy(zh);
  return {
    version: 2,
    key: `${makeKey(e)}|empty`,
    mode: "empty",
    event: eventOf(e, undefined, zh),
    slides: [],
    slideMs: SLIDE_MS,
    disclosure,
    badge,
    attributions: [],
    sources: [{ name: "commons-image", status: "unreachable", detail: reason }],
    offline: false,
    generatedAt: new Date().toISOString(),
  };
}

/** 本地策展集 → 幻灯片清单（受限网络下也能播真图） */
function curatedSlidesManifest(e: ReelEventInput, key: string, set: CuratedSet): ReelManifest {
  const zh = e.lang !== "en";
  const override = curatedEventOverride(set, e.lang || "zh");
  const slides: ReelSlide[] = set.slides.map((c, i) => {
    const license: LicenseInfo = {
      short: c.licenseShort,
      url: c.licenseUrl,
      author: c.author,
      attributionRequired: false,
      sourcePage: c.sourcePage,
      source: set.source,
    };
    return {
      index: i,
      url: c.url,
      title: c.title,
      note: c.note,
      caption: attributionLine({
        short: c.licenseShort, url: c.licenseUrl, author: c.author,
        sourcePage: c.sourcePage, source: set.source,
      }) + (c.verified ? "" : "（许可依据二手镜像标注，上线前须复核 Commons 文件页）"),
      width: c.width,
      height: c.height,
      license,
    };
  });
  return {
    version: 2,
    key: `${key}|${set.id}`,
    mode: "slides",
    event: eventOf(e, override, zh),
    slides,
    slideMs: SLIDE_MS,
    disclosure: zh ? set.disclosureZh : set.disclosureEn,
    badge: zh ? set.badgeZh : set.badgeEn,
    attributions: slides.map((s) => s.caption),
    sources: [{ name: set.source, status: "ok", count: slides.length, detail: "本地缓存的 Wikimedia Commons 公有领域史料照片，许可逐张核验，见 docs/REEL-COMMONS-CREDITS.md" }],
    offline: true,
    generatedAt: new Date().toISOString(),
  };
}

function mergeSources(list: SourceReport[]): SourceReport[] {
  const rank: Record<SourceReport["status"], number> = { ok: 4, filtered: 3, empty: 2, unreachable: 1, disabled: 0 };
  const map = new Map<string, SourceReport>();
  for (const s of list) {
    const prev = map.get(s.name);
    if (!prev) { map.set(s.name, { ...s }); continue; }
    if (rank[s.status] > rank[prev.status]) Object.assign(prev, s);
    if (s.count) prev.count = (prev.count || 0) + s.count;
  }
  return Array.from(map.values());
}

/** 在线检索 Commons 自由授权图片 → 幻灯片清单；无素材则返回 empty */
export async function buildManifest(raw: ReelEventInput): Promise<ReelManifest> {
  const e = normalizeInput(raw);
  const key = makeKey(e);
  const zh = e.lang !== "en";

  // ① 本地已核验策展集优先：任何网络下都能播真实史料照片，且只配给对应事件
  const curated = matchCuratedSet(e);
  if (curated) return curatedSlidesManifest(e, key, curated);

  // ② 在线检索：多组检索词 + 维基规范标题补充
  const queries = buildQueries(e);
  const primary = queries[0] || e.title || e.q || "history";
  const sources: SourceReport[] = [];
  const tasks = queries.slice(0, 2).map((q) => searchCommonsImages(q));
  const wikiP = resolveWikipediaTitle(primary);

  const [wiki, ...settled] = await Promise.all([
    wikiP,
    ...tasks.map((t) => t.catch(() => ({ images: [] as FoundImage[], sources: [] as SourceReport[] }))),
  ]);
  sources.push(...wiki.sources);

  const all: FoundImage[] = [];
  for (const r of settled) { if (r) { all.push(...r.images); sources.push(...r.sources); } }

  let extra: { images: FoundImage[]; sources: SourceReport[] } = { images: [], sources: [] };
  if (wiki.title && all.length < 3 && wiki.title.toLowerCase() !== primary.toLowerCase()) {
    extra = await searchCommonsImages(cleanTerms(`${wiki.title} ${e.year ?? ""}`)).catch(() => ({ images: [], sources: [] }));
  }
  for (const r of [extra]) { if (r) { all.push(...r.images); sources.push(...r.sources); } }

  // 去重（按 URL）+ 保持相关性顺序
  const seen = new Set<string>();
  const images = all
    .filter((a) => { if (seen.has(a.url)) return false; seen.add(a.url); return true; })
    .slice(0, MAX_SLIDES);

  const { disclosure, badge } = disclosureFor(zh, false);
  const base = {
    version: 2 as const,
    key,
    event: eventOf(e, undefined, zh),
    slideMs: SLIDE_MS,
    disclosure,
    badge,
    sources: mergeSources(sources),
    offline: false,
    generatedAt: new Date().toISOString(),
  };

  if (!images.length) {
    const ec = emptyCopy(zh);
    return {
      ...base,
      mode: "empty",
      slides: [],
      disclosure: ec.disclosure,
      badge: ec.badge,
      attributions: [],
    };
  }

  const slides: ReelSlide[] = images.map((a, i) => ({
    index: i,
    url: a.url,
    title: a.title || (zh ? `史料照片 ${i + 1}` : `Archival photo ${i + 1}`),
    note: a.note || (zh ? "Wikimedia Commons 自由授权史料照片" : "Freely licensed photo, Wikimedia Commons"),
    caption: captionFor(a),
    width: a.width,
    height: a.height,
    license: a.license,
  }));
  return {
    ...base,
    mode: "slides",
    slides,
    attributions: slides.map((s) => s.caption),
  };
}
