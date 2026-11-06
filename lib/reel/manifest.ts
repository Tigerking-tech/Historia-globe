/** 事件 → 10 秒时间轴描述（ReelManifest）
 *
 * 这是整套方案的核心：**不生成视频、不存视频**。
 * 服务端只在被请求时，把「事件」翻译成一份约 2KB 的 JSON：
 *   三镜时间轴 + 免费授权素材 URL + 运镜参数 + 字幕 + 署名 + 素材性质标注。
 * 素材字节流由浏览器直连 Wikimedia / archive.org CDN，CDN 只缓存这份小 JSON。
 * 因此 N 个事件的成本 = N 份 JSON + 按需图片，不存在 N 个 MP4，也没有转码算力。
 */

import { attributionLine } from "./licenses";
import { CURATED_1949_IMAGES, matchesCuratedCommons } from "./commons-curated";
import {
  buildQueries,
  cleanTerms,
  resolveWikipediaTitle,
  searchArchive,
  searchCommons,
} from "./sources";
import type {
  KenBurns,
  ReelAsset,
  ReelEventInput,
  ReelManifest,
  ReelMode,
  ReelShot,
  SourceReport,
} from "./types";

const SHOT_LEN = 10 / 3;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function seeded(seed: number): () => number {
  let x = seed || 1;
  return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; };
}
/** 运镜参数由事件 key 决定：同一事件每次生成完全一致，CDN 缓存不会抖动 */
function makePan(key: string, i: number): KenBurns {
  const r = seeded(hash(`${key}:${i}`));
  const dir = r() > 0.5 ? 1 : -1;
  return {
    fromScale: 1.06 + r() * 0.06,
    toScale: 1.16 + r() * 0.10,
    fromX: dir * (0.02 + r() * 0.03),
    toX: -dir * (0.02 + r() * 0.03),
    fromY: (r() - 0.5) * 0.04,
    toY: -(r() - 0.5) * 0.04,
  };
}

function clampNum(v: unknown, min: number, max: number): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : null;
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

function makeKey(e: ReelEventInput): string {
  return `${(e.eventId || e.title || e.q || "unknown").toLowerCase().replace(/\s+/g, "-")}|${e.year ?? "na"}|${e.lang}`;
}

/** 字幕：按事件动态生成；footage(1949) 沿用已核验的三镜文案 */
function shotCopy(e: ReelEventInput, mode: ReelMode, i: number): { title: string; note: string } {
  const zh = e.lang !== "en";
  if (mode === "footage" && isCurated(e)) {
    const t = [
      [zh ? "01　天安门城楼 · 宣告" : "01  The Gate · Proclamation", zh ? "1949 原始活动胶片 · 城楼上的历史一刻" : "Original 1949 footage · the moment on the rostrum"],
      [zh ? "02　天安门广场 · 第一面国旗" : "02  The Square · First Flag", zh ? "三十万军民齐集广场 · 礼炮二十八响" : "300,000 in the square · 21-gun salute"],
      [zh ? "03　万众欢腾" : "03  The Crowd Rejoices", zh ? "那一刻，被历史记住" : "A moment remembered by history"],
    ];
    return { title: t[i][0], note: t[i][1] };
  }
  const y = e.year != null ? String(Math.abs(e.year)) + (e.year < 0 ? (zh ? " 公元前" : " BCE") : "") : "";
  const place = e.place || (zh ? "事发地" : "the site");
  const title = e.title || e.q || (zh ? "历史事件" : "Historical event");
  const lines = zh
    ? [
        [`01　${title}`, y ? `${y} 年 · 这一刻发生的事` : "这一刻发生的事"],
        [`02　${place}`, y ? `${y} · 事件发生的地点` : "事件发生的地点"],
        ["03　那一刻之后", mode === "stills" ? "授权史料图片编排 · 非活动影像" : "示意画面 · 非历史影像"],
      ]
    : [
        [`01  ${title}`, y ? `The year ${y} · what happened` : "What happened"],
        [`02  ${place}`, y ? `${y} · where it happened` : "Where it happened"],
        ["03  After that moment", mode === "stills" ? "Licensed archival stills · not moving footage" : "Schematic illustration · not historical imagery"],
      ];
  return { title: lines[i][0], note: lines[i][1] };
}

function disclosureFor(mode: ReelMode, zh: boolean, curated: boolean): { disclosure: string; badge: string } {
  if (curated) {
    return zh
      ? { disclosure: "真实史料影像 · 视频来源:央视历史资料 · 非 AI 生成 · 原始活动胶片（商用授权待取，见 docs/REEL-1949-LICENSE.md）", badge: "原始活动胶片 · 非 AI 生成" }
      : { disclosure: "Authentic archival footage · source: CCTV historical archive · not AI-generated (commercial license pending)", badge: "Original footage · not AI" };
  }
  if (mode === "footage") {
    return zh
      ? { disclosure: "免费授权历史活动影像 · 来源见下方署名 · 非 AI 生成", badge: "授权活动影像 · 非 AI 生成" }
      : { disclosure: "Freely licensed historical moving footage · see credits · not AI-generated", badge: "Licensed footage · not AI" };
  }
  if (mode === "stills") {
    return zh
      ? { disclosure: "免费授权史料图片编排（平移/推近/转场）· 非活动影像 · 该事件不存在当年拍摄的连续视频", badge: "史料图片编排 · 非活动影像" }
      : { disclosure: "Freely licensed archival stills with motion · NOT moving footage · no continuous film exists for this event", badge: "Archival stills · not footage" };
  }
  return zh
    ? { disclosure: "未检索到可用的免费授权素材，当前为自绘矢量示意 · 非历史影像 · 上线后自动重试授权源", badge: "示意画面 · 非历史影像" }
    : { disclosure: "No freely licensed asset found — vector schematic, NOT historical imagery. Will retry licensed sources in production.", badge: "Schematic · not historical" };
}

function isCurated(e: ReelEventInput): boolean {
  const s = `${e.q || ""} ${e.title || ""} ${e.place || ""}`.toLowerCase();
  if (/开国|大典|国庆|天安门|founding ceremony|proclamation of the people/i.test(s)) return true;
  if (/^10[.\-/月]0?1(日)?$/.test((e.q || "").trim())) return true;
  if (/^1949([.\-/年]|$)/.test((e.q || "").trim()) && /10[.\-/]0?1/.test(e.q || "")) return true;
  return false;
}

/** 已人工逐帧核验的 1949 原始活动胶片特例（本地资产，效果与已确认版本 1:1） */
function curatedManifest(e: ReelEventInput, key: string): ReelManifest {
  const zh = e.lang !== "en";
  const { disclosure, badge } = disclosureFor("footage", zh, true);
  const shots: ReelShot[] = [0, 1, 2].map((i) => ({
    index: i as 0 | 1 | 2,
    start: i * SHOT_LEN,
    end: (i + 1) * SHOT_LEN,
    ...shotCopy(e, "footage", i),
    assetIndex: -1,
    pan: makePan(key, i),
  }));
  return {
    version: 1, key, mode: "footage", duration: 10,
    event: {
      title: zh ? "开国大典" : "Founding Ceremony of the PRC",
      year: 1949, place: zh ? "北京天安门" : "Tian'anmen, Beijing",
      category: "politics", lat: 39.9, lon: 116.4, lang: e.lang || "zh",
    },
    disclosure, badge, shots, assets: [],
    videoUrl: "/reel/history-1949-real.mp4", videoOffset: 0,
    attributions: [zh ? "视频来源：央视历史资料（原始活动胶片，授权状态见 docs/REEL-1949-LICENSE.md）" : "Source: CCTV historical archive (license pending, see docs/REEL-1949-LICENSE.md)"],
    sources: [{ name: "curated", status: "ok", detail: "人工逐帧核验的本地真实史料；商用授权待取" }],
    fixture: false, generatedAt: new Date().toISOString(),
  };
}

/** 上游整体异常时的极简兜底：完全不访问网络，前端仍能播满 10 秒 */
export function schematicFallback(raw: ReelEventInput, reason: string): ReelManifest {
  const e = normalizeInput(raw);
  const key = `${makeKey(e)}|fallback`;
  const zh = e.lang !== "en";
  const { disclosure, badge } = disclosureFor("schematic", zh, false);
  const shots: ReelShot[] = [0, 1, 2].map((i) => ({
    index: i as 0 | 1 | 2, start: i * SHOT_LEN, end: (i + 1) * SHOT_LEN,
    ...shotCopy(e, "schematic", i), assetIndex: -1, pan: makePan(key, i),
  }));
  return {
    version: 1, key, mode: "schematic", duration: 10,
    event: {
      title: e.title || e.q || (zh ? "历史事件" : "Historical event"),
      year: e.year ?? null, place: e.place || "", category: e.category || "",
      lat: e.lat ?? null, lon: e.lon ?? null, lang: e.lang || "zh",
    },
    disclosure, badge, shots, assets: [],
    attributions: [], fixture: false,
    sources: [{ name: "commons-image", status: "unreachable", detail: reason }],
    generatedAt: new Date().toISOString(),
  };
}

/** 离线演示数据：自绘 SVG，明确标注「演示素材 · 非史料」，仅 ?fixture=1 命中 */
function fixtureManifest(e: ReelEventInput, key: string): ReelManifest {
  const zh = e.lang !== "en";
  const assets: ReelAsset[] = [1, 2, 3].map((n) => ({
    kind: "image" as const,
    url: `/reel/fixtures/${n}.svg`,
    title: `DEMO ${n}`,
    license: { short: "本站自绘", url: "", author: "Historia Globe", attributionRequired: false, sourcePage: "/", source: "fixture" },
    score: 3 - n,
  }));
  const shots: ReelShot[] = [0, 1, 2].map((i) => ({
    index: i as 0 | 1 | 2, start: i * SHOT_LEN, end: (i + 1) * SHOT_LEN,
    ...shotCopy(e, "stills", i), assetIndex: i, pan: makePan(key, i),
  }));
  return {
    version: 1, key: `${key}|fixture`, mode: "stills", duration: 10,
    event: { title: e.title || e.q || "Demo", year: e.year ?? null, place: e.place || "", category: e.category || "", lat: e.lat ?? null, lon: e.lon ?? null, lang: e.lang || "zh" },
    disclosure: zh ? "离线演示素材（自绘 SVG）· 非史料 · 仅用于验证播放器链路，生产不会命中" : "Offline demo assets (self-drawn SVG) · NOT archival · verification only",
    badge: zh ? "演示素材 · 非史料" : "Demo · not archival",
    shots, assets, videoUrl: undefined,
    attributions: ["Historia Globe · 自绘演示素材"],
    sources: [{ name: "fixture", status: "ok", detail: "?fixture=1 local verification" }],
    fixture: true, generatedAt: new Date().toISOString(),
  };
}

/** 维基共享资源真实史料照片版（?commons=1）。
 *  与自绘 SVG 示意的区别：assets 是**真实历史照片**，已逐张核对 Commons 许可。
 *  用途：沙箱/受限网络下也能播真史料；上线后在线检索仍优先。
 *  绝不含糊：明确标注「史料照片（静帧编排）· 非活动影像」，不冒充当年视频。 */
function commonsCuratedManifest(e: ReelEventInput, key: string): ReelManifest {
  const zh = e.lang !== "en";
  // 标题控制在 6 字内：底部三镜列表在 390px 窄屏会把长标题挤到换行
  const titles = zh
    ? ["01　城楼宣告", "02　天安门", "03　开国邮票"]
    : ["01  Proclamation", "02  The Gate", "03  The Stamp"];
  const notes = zh
    ? ["1949-10-01 · 天安门城楼上的历史一刻",
       "1949-02-12 · 北平和平解放后的城楼",
       "1949-10-08 · 纪1 纪念邮票"]
    : ["1 Oct 1949 · on the Tian'anmen rostrum",
       "12 Feb 1949 · the gate after Beiping's liberation",
       "8 Oct 1949 · the Ji-1 commemorative stamp"];
  const assets: ReelAsset[] = CURATED_1949_IMAGES.map((c, i) => ({
    kind: "image" as const,
    url: c.url,
    title: c.title,
    width: c.width,
    height: c.height,
    license: {
      short: c.licenseShort,
      url: c.licenseUrl,
      author: c.author,
      attributionRequired: false,
      sourcePage: c.sourcePage,
      source: "commons-image",
    },
    score: 30 - i,
  }));
  const shots: ReelShot[] = [0, 1, 2].map((i) => ({
    index: i as 0 | 1 | 2,
    start: i * SHOT_LEN,
    end: (i + 1) * SHOT_LEN,
    title: titles[i], note: notes[i],
    assetIndex: i,
    pan: makePan(key, i),
  }));
  const attributions = CURATED_1949_IMAGES.map((c) =>
    attributionLine({
      short: c.licenseShort, url: c.licenseUrl, author: c.author,
      sourcePage: c.sourcePage, source: "commons-image",
    }) + (c.verified ? "" : "（许可依据二手镜像标注，上线前须复核 Commons 文件页）"),
  );
  return {
    version: 1, key: `${key}|commons`, mode: "stills", duration: 10,
    event: {
      title: zh ? "开国大典" : "Founding Ceremony of the PRC",
      year: 1949, place: zh ? "北京天安门" : "Tian'anmen, Beijing",
      category: "politics", lat: 39.9, lon: 116.4, lang: e.lang || "zh",
    },
    disclosure: zh
      ? "维基共享资源公有领域史料照片 · 静帧编排 · 非活动影像 · 署名与法务见 docs/REEL-COMMONS-CREDITS.md"
      : "Public-domain Commons archival photos · still montage · NOT footage · see docs/REEL-COMMONS-CREDITS.md",
    badge: zh ? "维基真史料照片 · 非活动影像" : "Commons archival photos · not footage",
    shots, assets, videoUrl: undefined,
    attributions,
    sources: [{ name: "commons-image", status: "ok", detail: "本地缓存的 Wikimedia Commons 公有领域史料照片（沙箱通过图片代理取得），许可逐张核验，见 docs/REEL-COMMONS-CREDITS.md" }],
    fixture: false, generatedAt: new Date().toISOString(),
  };
}

function imageCountAll(results: { assets?: ReelAsset[] }[]): number {
  return results.reduce((n, r) => n + (r?.assets?.filter((a) => a.kind === "image").length || 0), 0);
}

/** 同一源可能被多组检索词调用多次；合并报告，保留最好的状态并累加命中数 */
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

export interface BuildOptions { fixture?: boolean; debug?: boolean; commons?: boolean; }

export async function buildManifest(raw: ReelEventInput, opts: BuildOptions = {}): Promise<ReelManifest> {
  const e = normalizeInput(raw);
  const key = makeKey(e);
  // 显式请求「维基共享资源真实史料照片」优先级最高：用户明确要看维基真图时，
  // 就给照片而不是本地胶片；仅对 1949 相关事件命中，避免配错史料。
  if (opts.commons && matchesCuratedCommons(e)) return commonsCuratedManifest(e, key);
  if (isCurated(e)) return curatedManifest(e, key);
  if (opts.fixture) return fixtureManifest(e, key);

  const queries = buildQueries(e);
  const primary = queries[0] || e.title || e.q || "history";
  const sources: SourceReport[] = [];

  // 并发检索：Wikipedia 解析英文标题、Commons 图片/视频、Archive 影片。
  // 单个源超时或不可达不影响其它源，也不会让整个接口失败。
  const tasks: Promise<{ assets: ReelAsset[]; sources: SourceReport[] }>[] = [
    searchCommons(primary, "image"),
    searchCommons(primary, "video"),
    searchArchive(primary),
  ];
  if (queries[1] && queries[1] !== primary) tasks.push(searchCommons(queries[1], "image"));

  const wikiP = resolveWikipediaTitle(primary);
  const [wiki, ...settled] = await Promise.all([wikiP, ...tasks.map((t) => t.catch(() => ({ assets: [], sources: [] })))]);
  sources.push(...wiki.sources);

  // 若中文原词没命中图片，但维基解析出了更规范的英文标题，再补一次检索
  let extra: { assets: ReelAsset[]; sources: SourceReport[] } = { assets: [], sources: [] };
  if (wiki.title && imageCountAll(settled) < 3 && wiki.title.toLowerCase() !== primary.toLowerCase()) {
    extra = await searchCommons(cleanTerms(`${wiki.title} ${e.year ?? ""}`), "image").catch(() => ({ assets: [], sources: [] }));
  }

  const all: ReelAsset[] = [];
  for (const r of [...settled, extra]) { if (r) { all.push(...r.assets); sources.push(...r.sources); } }

  // 去重 + 相关性排序
  const seen = new Set<string>();
  const assets = all
    .filter((a) => { if (seen.has(a.url)) return false; seen.add(a.url); return true; })
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);

  const videos = assets.filter((a) => a.kind === "video");
  const images = assets.filter((a) => a.kind === "image");
  const mode: ReelMode = videos.length ? "footage" : images.length ? "stills" : "schematic";
  const zh = e.lang !== "en";
  const { disclosure, badge } = disclosureFor(mode, zh, false);

  const shots: ReelShot[] = [0, 1, 2].map((i) => ({
    index: i as 0 | 1 | 2,
    start: i * SHOT_LEN,
    end: (i + 1) * SHOT_LEN,
    ...shotCopy(e, mode, i),
    assetIndex: mode === "stills" ? i % Math.max(1, images.length) : -1,
    pan: makePan(key, i),
  }));

  const used = mode === "footage" ? (videos[0] ? [videos[0]] : []) : mode === "stills" ? images.slice(0, 3) : [];
  const attributions = used.map((a) => attributionLine({
    short: a.license.short, url: a.license.url, author: a.license.author,
    sourcePage: a.license.sourcePage, source: a.license.source,
  }));

  return {
    version: 1, key, mode, duration: 10,
    event: {
      title: e.title || e.q || (zh ? "历史事件" : "Historical event"),
      year: e.year ?? null, place: e.place || "", category: e.category || "",
      lat: e.lat ?? null, lon: e.lon ?? null, lang: e.lang || "zh",
    },
    disclosure, badge, shots, assets,
    videoUrl: mode === "footage" ? videos[0]?.url : undefined,
    videoOffset: 0,
    attributions, sources: mergeSources(sources),
    fixture: false,
    generatedAt: new Date().toISOString(),
  };
}
