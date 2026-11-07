// 静态可索引内容层（GEO / SEO）。
//
// 设计要点：这一层**只读本地策展数据**，绝不发起任何外部网络请求。
// 因此 600+ 个静态页可以在 build 期一次性生成，不依赖 Vercel 境外连通性，
// 也不会因为 Wikipedia / Wikidata 不可达而让页面内容空白。
//
// 诚实边界：SEED_EVENTS 是「已核验的本地策展库」，不是 Wikipedia 实时数据。
// 每个页面都明确写出数据来源与「上线后外部源自动补齐」的说明，不把稀疏数据
// 伪装成完整的一天，也不为没有照片的事件编造图片。

import { SEED_EVENTS, type SeedEvent } from "./seed-events";
import { CURATED_SETS } from "./reel/curated-slides";
import generated from "../data/generated-events.json";

// ---- 构建期补入的静态条目（由 scripts/build-static-content.mjs 生成） ----
// 这一层是**只读补充**：只进日期页，绝不并入 CONTENT_EVENTS。
// 原因：生成条目没有经纬度、没有站内事件页/地点页，并进去会破坏地球 pin 层、
// 事件页与地点页链路，还会在页面上渲染出 NaN° 坐标和 /event/ 死链。
// 因此页面渲染时单独成段，直接链接到该条目的真实 Wikipedia 出处 URL。
export type SupplementalEvent = {
  m: number;
  d: number;
  year: number;
  title: string;
  description: string;
  sourceUrl: string;
};

const SUPPLEMENTAL_MAP = new Map<string, SupplementalEvent[]>();
{
  type Raw = Partial<SupplementalEvent> & { m?: unknown; d?: unknown; year?: unknown };
  const rows = (generated as unknown as { events?: Raw[] }).events ?? [];
  const seen = new Set<string>();
  for (const g of rows) {
    if (!g || typeof g !== "object") continue;
    if (!Number.isInteger(g.m) || !Number.isInteger(g.d) || !Number.isFinite(g.year as number)) continue;
    if (typeof g.title !== "string" || !g.title.trim()) continue;
    if (typeof g.sourceUrl !== "string" || !/^https:\/\//.test(g.sourceUrl)) continue;
    const m = g.m as number, d = g.d as number, year = g.year as number;
    if (m < 1 || m > 12 || d < 1 || d > 31) continue;
    const key = `${m}-${d}-${year}-${g.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const item: SupplementalEvent = {
      m, d, year,
      title: g.title.trim().slice(0, 240),
      description: typeof g.description === "string" ? g.description.slice(0, 600) : "",
      sourceUrl: g.sourceUrl,
    };
    const slug = dateSlug(m, d);
    if (!SUPPLEMENTAL_MAP.has(slug)) SUPPLEMENTAL_MAP.set(slug, []);
    SUPPLEMENTAL_MAP.get(slug)!.push(item);
  }
  // 用 Array.from 而非直接迭代 Map.values()：项目 tsconfig target 低于 es2015，
  // 直接 for...of 会触发 TS2802（需要 downlevelIteration）。
  for (const list of Array.from(SUPPLEMENTAL_MAP.values())) {
    list.sort((a: SupplementalEvent, b: SupplementalEvent) => b.year - a.year);
  }
}

/** 日期页专用：该日期从 Wikipedia On this day 补入的静态条目（可能为空数组）。 */
export function getSupplementalEvents(slug: string): SupplementalEvent[] {
  return SUPPLEMENTAL_MAP.get(slug) ?? [];
}

export function supplementalStats() {
  return {
    events: Array.from(SUPPLEMENTAL_MAP.values()).reduce((n, l) => n + l.length, 0),
    days: SUPPLEMENTAL_MAP.size,
    status: (generated as { status?: string }).status ?? "unknown",
  };
}

export type ContentEvent = SeedEvent & {
  slug: string;
  dateSlug: string;
  placeSlug: string;
  /** 可点击的维基百科检索链接（策展事件没有单一权威原文，故标为「检索页」） */
  sourceUrl: string;
};

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function yearSlug(year: number): string {
  return year < 0 ? `${-year}bce` : String(year);
}

export function dateSlug(m: number, d: number): string {
  return `${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function dateLabel(m: number, d: number): string {
  const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${MONTHS[m - 1]} ${d}`;
}

/** 维基百科检索页。策展条目没有单一原文 URL，所以如实标为检索而非「原始出处」。 */
export function wikiSearchUrl(title: string): string {
  return `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(title)}`;
}

function buildEvents(): ContentEvent[] {
  return SEED_EVENTS.map((e) => {
    const ds = dateSlug(e.m, e.d);
    return {
      ...e,
      slug: `${slugify(e.title)}-${yearSlug(e.year)}`,
      dateSlug: ds,
      placeSlug: slugify(e.place),
      sourceUrl: wikiSearchUrl(e.title),
    };
  });
}

export const CONTENT_EVENTS: ContentEvent[] = buildEvents();

/** 已核验的自由授权真实照片（目前只有 9/11 组，PD-USGov）。
 *  没有照片的事件绝不用矢量示意或生成图顶替，页面会如实说明。 */
export const VERIFIED_PHOTOS = CURATED_SETS.find((s) => s.id === "911")?.slides ?? [];

/** 哪些事件能配上已核验照片：仅世贸中心 / 9·11 相关策展条目。 */
export function photosForEvent(e: ContentEvent) {
  return /world trade center|9\/?11|wtc|ground zero/i.test(e.title)
    ? VERIFIED_PHOTOS
    : [];
}

// ---- 日期页 ----
export type DateContent = {
  m: number;
  d: number;
  slug: string;
  label: string;
  events: ContentEvent[];
};

const DATE_MAP = new Map<string, DateContent>();
for (const e of CONTENT_EVENTS) {
  const key = e.dateSlug;
  if (!DATE_MAP.has(key)) {
    DATE_MAP.set(key, {
      m: e.m, d: e.d, slug: key,
      label: dateLabel(e.m, e.d), events: [],
    });
  }
  DATE_MAP.get(key)!.events.push(e);
}
for (const v of Array.from(DATE_MAP.values())) v.events.sort((a: ContentEvent, b: ContentEvent) => b.year - a.year);

export function getDateContent(slug: string): DateContent | null {
  return DATE_MAP.get(slug) || null;
}

/** 有策展事件的日期（build 期预生成；其余日期按需 SSR，sitemap 仍会列出）。 */
export function allDateSlugs(): string[] {
  return Array.from(DATE_MAP.keys()).sort();
}

/** 366 天全量日期串，供 sitemap 使用（含无事件日，页面会诚实显示 0 条）。 */
export function everyDateSlug(): string[] {
  const days = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const out: string[] = [];
  for (let m = 1; m <= 12; m++) {
    for (let d = 1; d <= days[m - 1]; d++) out.push(dateSlug(m, d));
  }
  return out;
}

export function parseDateSlug(slug: string): { m: number; d: number } | null {
  const m = slug.match(/^(\d{2})-(\d{2})$/);
  if (!m) return null;
  const mo = Number(m[1]), da = Number(m[2]);
  const days = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (mo < 1 || mo > 12 || da < 1 || da > days[mo - 1]) return null;
  return { m: mo, d: da };
}

/** 邻近有事件的日期，用于「这一天暂无策展事件」时的诚实引导。 */
export function nearbyDates(slug: string, n = 4): DateContent[] {
  const all = allDateSlugs();
  const i = all.indexOf(slug);
  const base = i >= 0 ? i : Math.max(0, all.findIndex((s) => s > slug));
  const out: DateContent[] = [];
  // 注意：这里必须是 k++（向前取更早的日期）。写成 k-- 会无限循环，
  // 静态生成日期页时会直接卡满 60s 超时。
  for (let k = 1; k <= n && base - k >= 0; k++) {
    const c = DATE_MAP.get(all[base - k]);
    if (c) out.unshift(c);
  }
  for (let k = 1; out.length < n && base + k < all.length; k++) {
    const c = DATE_MAP.get(all[base + k]);
    if (c) out.push(c);
  }
  return out.filter(Boolean).slice(0, n);
}

// ---- 事件页 ----
const EVENT_MAP = new Map<string, ContentEvent>();
for (const e of CONTENT_EVENTS) {
  // 万一 slug 撞车，追加日期保证唯一
  let key = e.slug;
  if (EVENT_MAP.has(key)) key = `${key}-${e.dateSlug}`;
  EVENT_MAP.set(key, e);
}
export function getEventContent(slug: string): ContentEvent | null {
  return EVENT_MAP.get(slug) || null;
}
export function allEventSlugs(): string[] {
  return Array.from(EVENT_MAP.keys());
}

// ---- 地点页 ----
export type PlaceContent = { slug: string; place: string; events: ContentEvent[] };
const PLACE_MAP = new Map<string, PlaceContent>();
for (const e of CONTENT_EVENTS) {
  if (!PLACE_MAP.has(e.placeSlug)) {
    PLACE_MAP.set(e.placeSlug, { slug: e.placeSlug, place: e.place, events: [] });
  }
  PLACE_MAP.get(e.placeSlug)!.events.push(e);
}
for (const v of Array.from(PLACE_MAP.values())) v.events.sort((a: ContentEvent, b: ContentEvent) => b.year - a.year);

export function getPlaceContent(slug: string): PlaceContent | null {
  return PLACE_MAP.get(slug) || null;
}
/** 事件数 >= 2 的地点优先预生成，长尾按需 SSR。 */
export function allPlaceSlugs(): string[] {
  return Array.from(PLACE_MAP.values())
    .filter((p) => p.events.length >= 2)
    .map((p) => p.slug)
    .sort();
}

export function stats() {
  return {
    events: CONTENT_EVENTS.length,
    daysWithEvents: DATE_MAP.size,
    places: PLACE_MAP.size,
    verifiedPhotos: VERIFIED_PHOTOS.length,
  };
}
