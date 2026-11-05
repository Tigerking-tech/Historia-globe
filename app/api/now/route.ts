import { NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { findLandmark, LANDMARKS, pexelsPhotoUrl, distanceKm } from "@/lib/landmarks";

// ============================================================================
// 「此刻此地 / Right Now」服务端聚合
//
// 产品理念：Historia Globe 不只是「对话历史」，也要「活在当下」。
// 用户点开按钮，看到**这个地点现在从地面看是什么样**、**这一刻**的当地时间
// 与天气，与卡片下方的历史事件古今同框。
//
// 图片采用三级图源，逐级回退（全部服务端同源代理，浏览器不直连上游）：
//   L1 地标实景：lib/landmarks.ts（Pexels License，免费商用）
//                —— 历史事件发生在著名地点时，展示该地标今天的地面照片
//                   例：1949-10-01 开国大典 → 今天的天安门城楼
//   L2 地面街景：Panoramax（开源街景，CC BY-SA 4.0），按 bbox 搜索附近
//                真实地面照片，按距离 + 拍摄朝向评分，带拍摄日期与作者
//   L3 卫星俯视：Esri World Imagery 单张连续航拍（© Esri），永远可用的兜底
//
// 时间：Open-Meteo 的 current.time 是 15 分钟观测时次（如 12:45），
//       不是墙钟时间。当地时间一律由服务端真实时刻 + IANA 时区计算，
//       前端基于 serverNow 每秒走字，保证与用户手机一致。
// ============================================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ESRI_EXPORT =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export";
const OPEN_METEO = "https://api.open-meteo.com/v1/forecast";
const PANORAMAX_SEARCH = "https://api.panoramax.xyz/api/search";
const FETCH_TIMEOUT_MS = 12_000;
const MAX_IMAGE_BYTES = 3_000_000;

// 地面实景取图：Panoramax 图片 CDN 在部分网络 10s+ 超时，多个候选串行等待
// 曾累计到 26.9s，前端等不到图就自动回退卫星。改为多候选并发竞速：
//   1) 每个候选同时发「wsrv.nl 代理」与「直连」，谁先返回有效图片用谁（实测代理 1.6-1.9s）；
//   2) 服务端对代理只访问固定域名 → 天然规避 SSRF；直连 URL 经 host 白名单；
//   3) 首个成功后 abort 其余在途请求，避免连接堆积。
const WSRV_PROXY = "https://wsrv.nl/?url=";
const HG_UA = "HistoriaGlobe/1.0 (personal SaaS; contact via repository)";
const IMG_RACE_TIMEOUT_MS = 9_000;
/** 多级 bbox 半径（deg）：约 450m / 1.3km / 3.3km / 8km，并发检索 */
const PANORAMAX_RADII = [0.004, 0.012, 0.03, 0.075];
/** 近处候选不足时才追加的远半径（约 16km / 33km），救回发射场、海港等稀疏地区 */
const PANORAMAX_FAR_RADII = [0.15, 0.3];
const PANORAMAX_LIMIT = 40;
const MAX_GROUND_CANDIDATES = 6;
/** 只采用距事件点 3km 内的街景：更远的照片与该地点无关（实测 12km 外只剩电线杆/树冠），宁可回退卫星 */
const MAX_STREET_DISTANCE_M = 3000;
const IMG_CACHE = new Map<string, { buf: Buffer; ts: number }>();

function proxyImageUrl(u: string, w = 900) {
  return `${WSRV_PROXY}${encodeURIComponent(u)}&w=${w}`;
}

/** 直连白名单：只允许 Pexels CDN 与 Panoramax 官方/社区实例，防止第三方 URL 注入 */
function safeDirectUrl(u: string): string | null {
  try {
    const p = new URL(u);
    if (p.protocol !== "https:") return null;
    const h = p.hostname.toLowerCase();
    if (h === "images.pexels.com") return u;
    if (/(^|\.)panoramax\./.test(h) || /(^|\.)openstreetmap\.fr$/.test(h) || /(^|\.)panoramax\.xyz$/.test(h)) return u;
    return null;
  } catch { return null; }
}

async function tryImage(u: string, maxBytes: number, signal: AbortSignal): Promise<Buffer> {
  const res = await fetch(u, { signal, headers: { "User-Agent": HG_UA }, cache: "no-store" });
  if (!res.ok) throw new Error(`status ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const type = res.headers.get("content-type") || "";
  if (!buf.byteLength || buf.byteLength > maxBytes || !/image\//i.test(type)) throw new Error("invalid image");
  return buf;
}

/** 首个成功者胜出（不依赖 Promise.any，兼容低 target）；全部失败返回 null */
async function fetchFirstImage(urls: string[], maxBytes: number): Promise<Buffer | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), IMG_RACE_TIMEOUT_MS);
  const tasks: Promise<Buffer>[] = [];
  for (const u of urls.slice(0, 4)) {
    tasks.push(tryImage(proxyImageUrl(u), maxBytes, controller.signal));
    const direct = safeDirectUrl(u);
    if (direct) tasks.push(tryImage(direct, maxBytes, controller.signal));
  }
  try {
    if (!tasks.length) return null;
    return await new Promise<Buffer | null>((resolve) => {
      let failed = 0;
      let done = false;
      for (const t of tasks) {
        t.then(
          (b) => { if (!done) { done = true; resolve(b); } },
          () => { failed += 1; if (!done && failed === tasks.length) { done = true; resolve(null); } },
        );
      }
    });
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

type City = { n: string; nz?: string; la: number; lo: number; p?: number };
let CITIES_CACHE: City[] | null = null;

/** Panoramax 候选图片缓存：key -> 候选 URL 列表（URL 只由服务端生成，无 SSRF） */
const GROUND_CACHE = new Map<string, { candidates: string[]; ts: number }>();
function cacheGc() {
  if (GROUND_CACHE.size <= 300) return;
  const entries = Array.from(GROUND_CACHE.entries()).sort((a, b) => a[1].ts - b[1].ts);
  for (const [k] of entries.slice(0, 100)) GROUND_CACHE.delete(k);
}

function loadCities(): City[] {
  if (CITIES_CACHE) return CITIES_CACHE;
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), "public", "cities.json"), "utf8");
    CITIES_CACHE = JSON.parse(raw) as City[];
  } catch {
    CITIES_CACHE = [];
  }
  return CITIES_CACHE;
}

/** WMO 天气代码 → 中英文描述 */
const WMO: Record<number, [string, string]> = {
  0: ["Clear sky", "晴朗"], 1: ["Mainly clear", "大部晴朗"], 2: ["Partly cloudy", "局部多云"],
  3: ["Overcast", "阴"], 45: ["Fog", "雾"], 48: ["Rime fog", "雾凇"],
  51: ["Light drizzle", "小毛毛雨"], 53: ["Drizzle", "毛毛雨"], 55: ["Dense drizzle", "浓毛毛雨"],
  56: ["Freezing drizzle", "冻毛毛雨"], 57: ["Dense freezing drizzle", "浓冻毛毛雨"],
  61: ["Slight rain", "小雨"], 63: ["Moderate rain", "中雨"], 65: ["Heavy rain", "大雨"],
  66: ["Freezing rain", "冻雨"], 67: ["Heavy freezing rain", "强冻雨"],
  71: ["Slight snow", "小雪"], 73: ["Moderate snow", "中雪"], 75: ["Heavy snow", "大雪"],
  77: ["Snow grains", "米雪"], 80: ["Slight showers", "阵雨"], 81: ["Showers", "中阵雨"],
  82: ["Violent showers", "强阵雨"], 85: ["Snow showers", "阵雪"], 86: ["Heavy snow showers", "强阵雪"],
  95: ["Thunderstorm", "雷暴"], 96: ["Thunderstorm with hail", "雷暴伴冰雹"],
  99: ["Thunderstorm with heavy hail", "雷暴伴大冰雹"],
};

function clampNum(v: string | null, min: number, max: number, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
}

function nearestCity(lat: number, lon: number) {
  const list = loadCities();
  let best: City | null = null;
  let bestD = Infinity;
  const latR = (lat * Math.PI) / 180;
  const cosLat = Math.max(0.15, Math.cos(latR));
  for (const c of list) {
    if (!Number.isFinite(c.la) || !Number.isFinite(c.lo)) continue;
    const dLat = c.la - lat;
    let dLon = c.lo - lon;
    if (dLon > 180) dLon -= 360;
    if (dLon < -180) dLon += 360;
    const d = dLat * dLat + dLon * dLon * cosLat * cosLat;
    if (d < bestD) { bestD = d; best = c; }
  }
  if (!best) return { en: "", zh: "", km: 0 };
  return { en: best.n, zh: best.nz || best.n, km: Math.round(Math.sqrt(bestD) * 111) };
}

/** 服务端真实时刻 + IANA 时区 → 当地日期 / 时:分 / 年（24 小时制，精确到分） */
function localClock(date: Date, tz: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    }).formatToParts(date);
    const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    return {
      localDate: `${g("year")}-${g("month")}-${g("day")}`,
      localTime: `${g("hour")}:${g("minute")}`,
      year: Number(g("year")) || date.getUTCFullYear(),
    };
  } catch {
    const iso = date.toISOString();
    return { localDate: iso.slice(0, 10), localTime: iso.slice(11, 16), year: date.getUTCFullYear() };
  }
}

/** 以 (lat,lon) 为中心导出一张连续航拍影像（L3 兜底） */
function photoUpstreamUrl(lat: number, lon: number, mode: "city" | "street", scale = 1) {
  const halfLat = (mode === "street" ? 0.008 : 0.013) * scale;
  const cos = Math.max(0.25, Math.cos((lat * Math.PI) / 180));
  const halfLon = Math.min(0.3, (halfLat * 1.45) / cos);
  const bbox = [lon - halfLon, lat - halfLat, lon + halfLon, lat + halfLat]
    .map((v) => v.toFixed(6)).join(",");
  return `${ESRI_EXPORT}?bbox=${bbox}&bboxSR=4326&size=900,620&imageSR=4326&format=jpg&f=image`;
}

async function fetchWithLimit(url: string, maxBytes: number) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { "User-Agent": "HistoriaGlobe/1.0 (personal SaaS; contact via repository)" },
    cache: "no-store",
  });
  if (!res.ok) return { ok: false as const, status: res.status };
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength === 0 || buf.byteLength > maxBytes) return { ok: false as const, status: 502 };
  return { ok: true as const, buf, type: res.headers.get("content-type") || "" };
}

function json(data: unknown, status = 200, cache = "no-store") {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": cache },
  });
}

// ---------------------------------------------------------------------------
// L2：Panoramax 开源街景，按 bbox 分级搜索，按距离 + 朝向评分
// ---------------------------------------------------------------------------
async function findPanoramax(lat: number, lon: number) {
  const cos = Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  const bboxOf = (half: number) => {
    const halfLon = Math.min(0.4, half / cos);
    return [lon - halfLon, lat - half, lon + halfLon, lat + half]
      .map((v) => v.toFixed(6)).join(",");
  };
  const search = async (radii: number[]) => {
    const batches = await Promise.all(
      radii.map(async (half) => {
        try {
          const r = await fetch(`${PANORAMAX_SEARCH}?bbox=${bboxOf(half)}&limit=${PANORAMAX_LIMIT}`, {
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), cache: "no-store",
          });
          return r.ok ? ((await r.json())?.features ?? []) as any[] : [];
        } catch { return [] as any[]; }
      }),
    );
    return batches.flat();
  };

  // 近处四级并发（总耗时≈一次最慢请求）；候选不足时才追加远半径，
  // 避免为「本来就有近处街景」的绝大多数事件白白多打两次上游。
  let feats = await search(PANORAMAX_RADII);
  if (feats.length < 3) feats = feats.concat(await search(PANORAMAX_FAR_RADII));

  // 按图片 URL 去重后做全局评分（不再「第一级命中即停」，避免近处凑合、
  // 更贴切的照片落在更大半径里被丢弃）
  type Candidate = {
    url: string; score: number; distanceM: number; photoDate: string;
    author: string; license: string; host: string;
  };
  const byUrl = new Map<string, Candidate>();
  for (const f of feats) {
    const url = f?.assets?.sd?.href;
    const coords = f?.geometry?.coordinates;
    if (typeof url !== "string" || !Array.isArray(coords) || byUrl.has(url)) continue;
    const [flon, flat] = coords as number[];
    if (!Number.isFinite(flon) || !Number.isFinite(flat)) continue;
    const km = distanceKm(lat, lon, flat, flon);
    const az = f.properties?.["view:azimuth"];
    // 照片位置指向目标点的方位角，偏好「对着这个地点拍」的照片
    const dLon = (lon - flon) * cos;
    const dLat = lat - flat;
    const bearing = ((Math.atan2(dLon, dLat) * 180) / Math.PI + 360) % 360;
    const aim = typeof az === "number" ? Math.abs(((az - bearing + 180) % 360) - 180) : 45;
    const props = f.properties ?? {};
    let host = "";
    try { host = new URL(url).hostname; } catch { /* skip */ }
    byUrl.set(url, {
      url,
      score: km * 1000 + aim * 8,
      distanceM: Math.round(km * 1000),
      photoDate: typeof props.datetime === "string" ? props.datetime.slice(0, 10) : "",
      author: Array.isArray(f.providers) && f.providers[0]?.name ? String(f.providers[0].name) : "Panoramax contributor",
      license: (f.links ?? []).find((l: any) => l?.rel === "license")?.href || "https://creativecommons.org/licenses/by-sa/4.0/",
      host,
    });
  }
  if (!byUrl.size) return null;

  // 质量闸：只保留 3km 内的街景。远半径找到的十几公里外照片与事件地点无关，
  // 与其用「一根电线杆」冒充实景，不如诚实回退卫星兜底。
  const scored = Array.from(byUrl.values())
    .filter((c) => c.distanceM <= MAX_STREET_DISTANCE_M)
    .sort((a, b) => a.score - b.score);
  // 跨实例分散候选：某个实例图片 CDN 不可达时，其它实例仍能出图
  const picked: Candidate[] = [];
  const hostCount = new Map<string, number>();
  for (const c of scored) {
    const n = hostCount.get(c.host) ?? 0;
    if (n >= 3) continue;
    hostCount.set(c.host, n + 1);
    picked.push(c);
    if (picked.length >= MAX_GROUND_CANDIDATES) break;
  }
  if (!picked.length) return null;

  const key = `pm:${randomUUID().slice(0, 12)}`;
  GROUND_CACHE.set(key, { candidates: picked.map((p) => p.url), ts: Date.now() });
  cacheGc();
  return {
    kind: "street" as const,
    key,
    img: `/api/now?part=groundimg&k=${encodeURIComponent(key)}&i=0`,
    count: picked.length,
    source: "Panoramax",
    credit: `© ${picked[0].author} / Panoramax (CC BY-SA 4.0)`,
    license: "CC BY-SA 4.0",
    licenseUrl: picked[0].license,
    photoDate: picked[0].photoDate || null,
    distanceM: picked[0].distanceM,
  };
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const lat = clampNum(q.get("lat"), -90, 90, 40.7128);
  const lon = clampNum(q.get("lon"), -180, 180, -74.006);
  const part = q.get("part") || "meta";

  // ---------- L1/L2 地面实景元数据 ----------
  if (part === "ground") {
    const hint = (q.get("place") || "").slice(0, 120);
    const lm = findLandmark(lat, lon, hint);
    if (lm) {
      const key = `lm:${lm.landmark.key}`;
      return json({
        kind: "landmark",
        key,
        place: { en: lm.landmark.en, zh: lm.landmark.zh },
        img: `/api/now?part=groundimg&k=${encodeURIComponent(key)}&i=0`,
        count: lm.landmark.photos.length,
        source: "Pexels",
        credit: "Photos from Pexels · Pexels License",
        license: "Pexels License",
        licenseUrl: "https://www.pexels.com/license/",
        photoDate: null,
        distanceM: Math.round(lm.km * 1000),
      });
    }
    const street = await findPanoramax(lat, lon);
    if (street) return json(street);
    return json({ kind: "none", source: null, credit: null, photoDate: null });
  }

  // ---------- 地面实景图片转发（k 只能是白名单枚举 key，URL 全由服务端生成） ----------
  if (part === "groundimg") {
    const k = (q.get("k") || "").slice(0, 40);
    let urls: string[] = [];
    if (k.startsWith("lm:")) {
      const lm = LANDMARKS.find((x) => x.key === k.slice(3));
      if (lm) urls = lm.photos.map((id) => pexelsPhotoUrl(id));
    } else if (k.startsWith("pm:")) {
      urls = GROUND_CACHE.get(k)?.candidates ?? [];
    }
    if (!urls.length) return json({ error: "unknown photo key" }, 404);
    const i = Math.min(urls.length - 1, Math.max(0, Math.round(Number(q.get("i") || 0)) || 0));

    // 服务端短缓存：同一地点被反复打开时不再重复回源（1 小时，最多 80 张）
    const cacheKey = `${k}:${i}`;
    const hit = IMG_CACHE.get(cacheKey);
    let buf: Buffer | null = hit && Date.now() - hit.ts < 3_600_000 ? hit.buf : null;
    if (!buf) {
      const ordered = [urls[i], ...urls.filter((_, idx) => idx !== i)];
      buf = await fetchFirstImage(ordered, MAX_IMAGE_BYTES);
      if (buf) {
        IMG_CACHE.set(cacheKey, { buf, ts: Date.now() });
        if (IMG_CACHE.size > 80) {
          const oldest = Array.from(IMG_CACHE.entries()).sort((a, b) => a[1].ts - b[1].ts)[0];
          if (oldest) IMG_CACHE.delete(oldest[0]);
        }
      }
    }
    if (!buf) return json({ error: "ground photo unavailable" }, 502);
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
        "X-Photo-Transport": "proxy/direct race",
      },
    });
  }

  // ---------- L3 卫星俯视（Esri 连续航拍，永远可用的兜底） ----------
  if (part === "photo") {
    const mode = q.get("mode") === "street" ? "street" : "city";
    let r: Awaited<ReturnType<typeof fetchWithLimit>>;
    try { r = await fetchWithLimit(photoUpstreamUrl(lat, lon, mode), MAX_IMAGE_BYTES); }
    catch { r = { ok: false, status: 502 }; }
    // 纯海洋 / 极地的小 bbox 上 Esri 会回 "Error: bytes" 500（上游限制，非本服务故障）。
    // 放大取景范围重试一次即可出图：实测北大西洋沉船点 0.013°→0.046° 由 500 变 200。
    if (!r.ok) {
      try { r = await fetchWithLimit(photoUpstreamUrl(lat, lon, mode, 3.5), MAX_IMAGE_BYTES); }
      catch { r = { ok: false, status: 502 }; }
    }
    // 上游 4xx/5xx 一律归一为 502，不把别人的 500 原样透传给浏览器
    if (!r.ok) return json({ error: "imagery unavailable" }, 502);
    if (!/image\//i.test(r.type)) return json({ error: "unexpected upstream response" }, 502);

    // 开阔海域 / 均一荒漠：Esri 会返回近乎纯色的极小 JPEG（实测北大西洋 16KB
    // 整片深蓝），直接呈现等于一块「加载失败」般的空白。改回自绘矢量示意图，
    // 明确标注「示意，非照片」，绝不把示意图伪装成实景。
    if (r.buf.byteLength < 20_000) {
      const waves = Array.from({ length: 7 }, (_, i) => {
        const y = 170 + i * 52;
        return `<path d="M-20 ${y} Q 100 ${y - 16}, 220 ${y} T 460 ${y} T 700 ${y} T 940 ${y}" stroke="#5eead4" stroke-opacity="${(0.2 - i * 0.018).toFixed(2)}" stroke-width="2" fill="none"/>`;
      }).join("");
      const grid = [150, 300, 450, 600, 750]
        .map((x) => `<line x1="${x}" y1="0" x2="${x}" y2="620" stroke="#7dd3fc" stroke-opacity="0.07" stroke-dasharray="4 10"/>`)
        .join("") + [155, 310, 465]
        .map((y) => `<line x1="0" y1="${y}" x2="900" y2="${y}" stroke="#7dd3fc" stroke-opacity="0.07" stroke-dasharray="4 10"/>`)
        .join("");
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="620" viewBox="0 0 900 620">
<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a2f52"/><stop offset="1" stop-color="#04101f"/></linearGradient></defs>
<rect width="900" height="620" fill="url(#s)"/>${grid}${waves}
<circle cx="450" cy="430" r="7" fill="#fbbf24"/><circle cx="450" cy="430" r="20" fill="none" stroke="#fbbf24" stroke-opacity="0.55" stroke-width="1.5"/>
<text x="450" y="250" fill="#e2e8f0" font-family="Arial, sans-serif" font-size="30" font-weight="600" text-anchor="middle" letter-spacing="3">NO GROUND-LEVEL VIEW</text>
<text x="450" y="292" fill="#94a3b8" font-family="Arial, sans-serif" font-size="18" text-anchor="middle">Open water / remote terrain at this coordinate</text>
<text x="450" y="330" fill="#fbbf24" font-family="Arial, sans-serif" font-size="16" text-anchor="middle">Illustration, not a photograph</text>
<text x="450" y="590" fill="#64748b" font-family="Arial, sans-serif" font-size="13" text-anchor="middle">© Esri World Imagery (base layer)</text>
</svg>`;
      return new Response(svg, {
        status: 200,
        headers: {
          "Content-Type": "image/svg+xml; charset=utf-8",
          "Cache-Control": "public, max-age=300, s-maxage=300",
          "X-Imagery-Credit": "Historia Globe (self-drawn illustration)",
        },
      });
    }

    return new Response(new Uint8Array(r.buf), {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=300, s-maxage=300",
        "X-Imagery-Credit": "© Esri World Imagery",
      },
    });
  }

  // ---------- 此刻：真实当地时间 / 昼夜 / 实时天气 / 地标名 ----------
  const weatherUrl = `${OPEN_METEO}?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m` +
    `&timezone=auto`;
  let wx: any = null;
  try {
    const r = await fetch(weatherUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), cache: "no-store" });
    if (r.ok) wx = await r.json();
  } catch { wx = null; }

  const cur = wx?.current ?? null;
  const code = Number(cur?.weather_code ?? 0);
  const label = WMO[code] ?? WMO[0];
  const tz = typeof wx?.timezone === "string" && wx.timezone ? wx.timezone : "UTC";
  const now = new Date();
  const clock = localClock(now, tz);
  const lm = findLandmark(lat, lon, (q.get("place") || "").slice(0, 120));

  return json({
    ok: true,
    lat, lon,
    place: nearestCity(lat, lon),
    landmark: lm ? { en: lm.landmark.en, zh: lm.landmark.zh } : null,
    serverNow: now.toISOString(),
    localDate: clock.localDate,
    localTime: clock.localTime,
    timezone: tz,
    timezoneAbbr: wx?.timezone_abbreviation ?? "",
    utcOffsetSeconds: Number(wx?.utc_offset_seconds ?? 0),
    isDay: Number(cur?.is_day ?? 1) === 1,
    weather: {
      code, en: label[0], zh: label[1],
      tempC: Number(cur?.temperature_2m ?? 0),
      apparentC: Number(cur?.apparent_temperature ?? cur?.temperature_2m ?? 0),
      humidity: Number(cur?.relative_humidity_2m ?? 0),
      windKmh: Number(cur?.wind_speed_10m ?? 0),
    },
    year: clock.year,
    live: Boolean(cur),
    credits: { weather: "Open-Meteo (CC BY 4.0)" },
  });
}
