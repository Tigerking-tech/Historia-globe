"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// 「此刻此地 / Right Now」
// 历史发生在这里 —— 这里现在**从地面看**是什么样、此刻几点、什么天气。
//
// 图片三级图源（服务端 /api/now 同源代理，浏览器不直连上游）：
//   L1 地标实景：Pexels（免费商用）—— 1949-10-01 开国大典 → 今天的天安门城楼
//   L2 地面街景：Panoramax（CC BY-SA 4.0），按坐标搜索附近真实地面照片
//   L3 卫星俯视：Esri 连续航拍（© Esri），永远可用的兜底
// 实时 = Open-Meteo 当地时间 / 昼夜 / 天气；时钟基于服务端 serverNow 每秒走字。
// 所有图标均为自绘矢量 SVG，不使用任何素材图片。

export type NowTarget = { lat: number; lon: number; label?: string };
export type NowEvent = { year: number; title: string; place?: string } | null;

type NowMeta = {
  ok: boolean;
  lat: number;
  lon: number;
  place: { en: string; zh: string; km: number };
  landmark: { en: string; zh: string } | null;
  serverNow: string;
  localDate: string;
  localTime: string;
  timezone: string;
  timezoneAbbr: string;
  utcOffsetSeconds: number;
  isDay: boolean;
  weather: {
    code: number;
    en: string;
    zh: string;
    tempC: number;
    apparentC: number;
    humidity: number;
    windKmh: number;
  };
  year: number;
  live: boolean;
  credits: { weather: string };
};

type GroundInfo = {
  kind: "landmark" | "street" | "none";
  key?: string;
  place?: { en: string; zh: string };
  img?: string;
  count?: number;
  source?: string | null;
  credit?: string | null;
  license?: string | null;
  licenseUrl?: string | null;
  photoDate?: string | null;
  distanceM?: number | null;
};

const EN = {
  eyebrow: "RIGHT NOW · 此刻此地",
  close: "Close",
  photoBadge: "This place, today",
  loading: "Fetching today's view…",
  photoFail: "Today's imagery is temporarily unavailable.",
  localTime: "Local time",
  daylight: "Daylight",
  night: "Night",
  day: "Day",
  weather: "Weather right now",
  feels: "Feels like",
  wind: "Wind",
  humidity: "Humidity",
  refresh: "Refresh",
  switchCity: "See another place right now",
  past: "THEN",
  present: "NOW",
  yearsApart: "years apart",
  noEvent: "Pick a historical event, then come back — see the same ground across time.",
  tagline: "History is not somewhere else. It is right here, right now.",
  taglineShort: "Not only the past. This place, right now.",
  disclaimer:
    "Ground photos are recent real photographs of this place (not a live street camera, not historical imagery). Local time, daylight and weather are live right now. Satellite view: © Esri World Imagery.",
  credits: "Pexels (Pexels License) · Panoramax (CC BY-SA 4.0) · Open-Meteo (CC BY 4.0) · © Esri · Natural Earth",
  liveUnavailable: "Live weather unavailable — local time shown from device.",
  fromGlobe: "Current view",
  near: "near",
  landmark: "landmark",
  viewGround: "Street view",
  viewSatellite: "Satellite",
  changePhoto: "Another photo",
  noGround: "No street-level photo here (offshore / remote areas often have none) — showing satellite view.",
  groundLandmark: "Real ground-level photo of this landmark today",
  groundStreet: "Street-level photo near this place",
  groundSatellite: "Current aerial / satellite imagery",
  takenOn: "taken",
  farAway: "photo taken ~",
};

const ZH = {
  eyebrow: "此刻此地 · RIGHT NOW",
  close: "关闭",
  photoBadge: "这里，现在的样子",
  loading: "正在取回此刻的实景…",
  photoFail: "此刻的影像暂时不可达。",
  localTime: "当地时间",
  daylight: "昼夜",
  night: "夜晚",
  day: "白天",
  weather: "此刻天气",
  feels: "体感",
  wind: "风速",
  humidity: "湿度",
  refresh: "刷新",
  switchCity: "看看别处此刻的样子",
  past: "过去",
  present: "现在",
  yearsApart: "年之隔",
  noEvent: "点选一个历史事件再回来，看看同一片土地隔着岁月的两端。",
  tagline: "历史不在别处，就在此刻脚下。",
  taglineShort: "不只是对话历史，也要活在当下。",
  disclaimer:
    "地面照片为该地点近期真实实景（非实时摄像头，也非历史影像）；当地时间、昼夜与天气为此刻实时数据。卫星图为 © Esri 当前航拍影像。",
  credits: "Pexels（Pexels License）· Panoramax（CC BY-SA 4.0）· Open-Meteo（CC BY 4.0）· © Esri · Natural Earth",
  liveUnavailable: "实时天气暂不可达，当地时间取自设备。",
  fromGlobe: "当前视野",
  near: "附近",
  landmark: "地标",
  viewGround: "地面实景",
  viewSatellite: "卫星俯视",
  changePhoto: "换一张",
  noGround: "该地点暂无地面街景（海上 / 偏远地区通常没有），已显示卫星俯视。",
  groundLandmark: "这座地标今天的地面实景",
  groundStreet: "该地点附近的真实地面街景",
  groundSatellite: "当前航拍 / 卫星影像",
  takenOn: "摄于",
  farAway: "照片取自约",
};

// 与 ExploreClient 的城市预设一致的坐标（卡片内切换不改地球相机）
const CHIPS: { id: string; en: string; zh: string; lat: number; lon: number }[] = [
  { id: "nyc", en: "New York", zh: "纽约", lat: 40.7128, lon: -74.006 },
  { id: "lon", en: "London", zh: "伦敦", lat: 51.5074, lon: -0.1278 },
  { id: "par", en: "Paris", zh: "巴黎", lat: 48.8566, lon: 2.3522 },
  { id: "tok", en: "Tokyo", zh: "东京", lat: 35.6762, lon: 139.6503 },
  { id: "sha", en: "Shanghai", zh: "上海", lat: 31.2304, lon: 121.4737 },
  { id: "dxb", en: "Dubai", zh: "迪拜", lat: 25.2048, lon: 55.2708 },
  { id: "rom", en: "Rome", zh: "罗马", lat: 41.9028, lon: 12.4964 },
  { id: "hk", en: "Hong Kong, China", zh: "中国香港", lat: 22.3193, lon: 114.1694 },
];

/** 自绘矢量天气图标：太阳 / 月亮 / 云 / 雨 / 雪 / 雷 */
function WeatherGlyph({ code, isDay, size = 34 }: { code: number; isDay: boolean; size?: number }) {
  const sun = "#fbbf24";
  const cloud = "#cbd5e1";
  const rain = "#60a5fa";
  const snowy = code === 71 || code === 73 || code === 75 || code === 77 || code === 85 || code === 86;
  const rainy = (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || snowy;
  const storm = code >= 95;
  const cloudy = code === 2 || code === 3 || code === 45 || code === 48 || rainy || storm;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      {isDay && !cloudy && (
        <>
          <circle cx="24" cy="24" r="8.5" fill={sun} />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
            const r = (a * Math.PI) / 180;
            return <line key={a} x1={24 + Math.cos(r) * 12} y1={24 + Math.sin(r) * 12}
              x2={24 + Math.cos(r) * 16} y2={24 + Math.sin(r) * 16}
              stroke={sun} strokeWidth="2.2" strokeLinecap="round" />;
          })}
        </>
      )}
      {!isDay && !cloudy && (
        <path d="M29.5 12a13 13 0 1 0 8.2 20.5A11 11 0 0 1 29.5 12Z" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />
      )}
      {cloudy && (
        <>
          {isDay && <circle cx="17" cy="17" r="7" fill={sun} opacity="0.95" />}
          <path d="M13 32.5a7.5 7.5 0 0 1 1.2-14.9 10 10 0 0 1 19.1 2.2 6.6 6.6 0 0 1-1.1 13.1H13Z" fill={cloud} opacity="0.92" />
          {storm && <path d="M25 33l-5 8h5l-2 7 9-11h-5l3-4Z" fill="#facc15" />}
          {rainy && !storm && (
            <>
              {[18, 26, 34].map((x) =>
                snowy ? (
                  <g key={x} stroke={rain} strokeWidth="1.6" strokeLinecap="round">
                    <line x1={x} y1="36" x2={x} y2="43" />
                    <line x1={x - 2.2} y1="38" x2={x + 2.2} y2="41" />
                    <line x1={x + 2.2} y1="38" x2={x - 2.2} y2="41" />
                  </g>
                ) : (
                  <line key={x} x1={x} y1="36" x2={x - 2} y2="43" stroke={rain} strokeWidth="2.2" strokeLinecap="round" />
                )
              )}
            </>
          )}
        </>
      )}
      {!cloudy && !isDay && <circle cx="38" cy="13" r="1.2" fill="#7dd3fc" />}
    </svg>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2.5">
      <div className="break-words text-[10px] uppercase tracking-wider text-slate-400">{label}</div>
      <div className="mt-1 break-words text-base font-semibold text-white leading-tight">{value}</div>
      {sub && <div className="mt-0.5 break-words text-[10px] text-slate-400 leading-tight">{sub}</div>}
    </div>
  );
}

export default function NowCard({
  target, lang, event, onClose,
}: {
  target: NowTarget;
  lang: "en" | "zh";
  event: NowEvent;
  onClose: () => void;
}) {
  const S = lang === "zh" ? ZH : EN;
  const zh = lang === "zh";
  const [pt, setPt] = useState<NowTarget>(target);
  const [meta, setMeta] = useState<NowMeta | null>(null);
  const [metaErr, setMetaErr] = useState(false);
  const [ground, setGround] = useState<GroundInfo | null>(null);
  const [groundLoading, setGroundLoading] = useState(true);
  const [view, setView] = useState<"ground" | "satellite">("ground");
  const [photoIndex, setPhotoIndex] = useState(0);
  const [photoErr, setPhotoErr] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(true);
  const [clock, setClock] = useState("");
  const [nonce, setNonce] = useState(0);
  const targetKey = `${target.lat.toFixed(4)},${target.lon.toFixed(4)}`;
  const lastTargetKey = useRef(targetKey);

  // 外部（重新打开 / 选中别的事件）换目标时同步
  useEffect(() => {
    if (lastTargetKey.current !== targetKey) {
      lastTargetKey.current = targetKey;
      setPt(target);
      setPhotoIndex(0);
    }
  }, [targetKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // 实时信息（当地时间 / 昼夜 / 天气 / 地标名）
  useEffect(() => {
    let alive = true;
    setMetaErr(false);
    const hint = encodeURIComponent((pt.label || event?.place || "").slice(0, 100));
    fetch(`/api/now?part=meta&lat=${pt.lat}&lon=${pt.lon}&lang=${lang}&place=${hint}&n=${nonce}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("meta"))))
      .then((d) => { if (alive) setMeta(d as NowMeta); })
      .catch(() => { if (alive) setMetaErr(true); });
    return () => { alive = false; };
  }, [pt.lat, pt.lon, lang, nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  // 三级图源元数据：优先地标实景 → 地面街景 → 卫星
  useEffect(() => {
    let alive = true;
    setGroundLoading(true);
    setGround(null);
    const hint = encodeURIComponent((pt.label || event?.place || "").slice(0, 100));
    fetch(`/api/now?part=ground&lat=${pt.lat}&lon=${pt.lon}&place=${hint}&n=${nonce}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("ground"))))
      .then((d) => { if (alive) setGround(d as GroundInfo); })
      .catch(() => { if (alive) setGround({ kind: "none" }); })
      .finally(() => { if (alive) setGroundLoading(false); });
    return () => { alive = false; };
  }, [pt.lat, pt.lon, nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  // 走秒时钟：以服务端 serverNow 为基准，避免设备时钟不准，并按当地时区显示
  useEffect(() => {
    if (!meta?.serverNow) return;
    const base = Date.parse(meta.serverNow);
    if (!Number.isFinite(base)) return;
    const localBase = Date.now();
    let fmt: Intl.DateTimeFormat;
    try {
      fmt = new Intl.DateTimeFormat("en-GB", {
        timeZone: meta.timezone || "UTC",
        hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
      });
    } catch {
      fmt = new Intl.DateTimeFormat("en-GB", {
        timeZone: "UTC", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
      });
    }
    const tick = () => setClock(fmt.format(new Date(base + (Date.now() - localBase))));
    tick();
    const t = window.setInterval(tick, 1000);
    return () => window.clearInterval(t);
  }, [meta?.serverNow, meta?.timezone]);

  const hasGround = !!ground && ground.kind !== "none" && !!ground.img;
  const activeView: "ground" | "satellite" =
    view === "ground" && !hasGround && !groundLoading ? "satellite" : view;
  const satelliteUrl = `/api/now?part=photo&lat=${pt.lat}&lon=${pt.lon}&n=${nonce}`;
  const groundUrl = ground?.img
    ? `${ground.img.replace(/&i=\d+$/, "")}&i=${photoIndex}&n=${nonce}`
    : null;
  const imgSrc = activeView === "ground" && groundUrl ? groundUrl : satelliteUrl;

  useEffect(() => {
    setPhotoLoading(true);
    setPhotoErr(false);
  }, [imgSrc]);

  const placeName = meta?.landmark
    ? zh ? meta.landmark.zh : meta.landmark.en
    : meta
      ? zh ? meta.place.zh || meta.place.en : meta.place.en || meta.place.zh
      : target.label || (zh ? "正在定位…" : "Locating…");

  // 副标题距离：优先「地面实景到查询点的真实距离」，否则回退「到最近城市距离」。
  // 地标命中时干脆不显示距离——meta.place.km 是到最近城市（北京）的距离，
  // 挂在「天安门广场」标题下会被误读成到地标本身的距离，数字宁缺勿错。
  const distM = ground?.distanceM;
  const nearDist = Number.isFinite(distM) && distM != null
    ? (distM >= 1000 ? `${(distM / 1000).toFixed(1)} km` : `${Math.round(distM)} m`)
    : meta?.place?.km != null ? `${meta.place.km} km` : null;

  const years = event && meta ? Math.max(0, meta.year - event.year) : null;
  const refresh = useCallback(() => setNonce((n) => n + 1), []);
  const w = meta?.weather;
  const weatherLabel = w ? (zh ? w.zh : w.en) : "";
  const timeShown = clock || meta?.localTime || "--:--";

  // 大半径救回的街景可能离事件点十几公里，如实标出实际距离，避免误认成就拍在脚下
  const farM = ground?.distanceM ?? 0;
  const farNote = activeView === "ground" && ground?.kind === "street" && farM > 2000 && nearDist
    ? ` · ${S.farAway} ${nearDist}` : "";
  const sourceNote = activeView === "satellite"
    ? S.groundSatellite
    : ground?.kind === "landmark"
      ? S.groundLandmark
      : ground?.kind === "street"
        ? `${S.groundStreet}${farNote}${ground.photoDate ? ` · ${S.takenOn} ${ground.photoDate}` : ""}`
        : S.groundSatellite;
  const sourceCredit = activeView === "satellite"
    ? "© Esri World Imagery"
    : ground?.source === "Pexels"
      ? "Pexels · Pexels License"
      : `${ground?.credit || "Panoramax"} · CC BY-SA 4.0`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={S.eyebrow}
    >
      <div
        className="relative w-full min-w-0 max-w-[430px] max-h-[90vh] overflow-y-auto rounded-2xl border border-white/15 bg-[#071426]/95 shadow-2xl [scrollbar-width:thin]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-emerald-300/90">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              {S.eyebrow}
            </div>
            <h2 className="editorial mt-1.5 truncate text-xl text-white">{placeName}</h2>
            {meta && (
              <div className="mt-0.5 truncate text-[10px] text-slate-400">
                {meta.landmark
                  ? `${S.landmark} · ${pt.lat.toFixed(3)}°, ${pt.lon.toFixed(3)}°`
                  : ground?.kind === "none"
                    ? `${S.viewSatellite} · ${pt.lat.toFixed(3)}°, ${pt.lon.toFixed(3)}°`
                    : `${S.near}${nearDist ? ` · ${nearDist}` : ""} · ${pt.lat.toFixed(3)}°, ${pt.lon.toFixed(3)}°`}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label={S.close}
            className="shrink-0 rounded-lg border border-white/15 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* 图源切换：默认地面实景，可切卫星俯视 */}
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 px-4 pb-2">
          <button
            onClick={() => setView("ground")}
            className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] transition ${
              activeView === "ground" ? "border-emerald-400/60 bg-emerald-400/15 text-emerald-200" : "border-white/15 text-slate-300 hover:bg-white/10"
            }`}
          >
            {S.viewGround}
          </button>
          <button
            onClick={() => setView("satellite")}
            className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] transition ${
              activeView === "satellite" ? "border-sky-400/60 bg-sky-400/15 text-sky-200" : "border-white/15 text-slate-300 hover:bg-white/10"
            }`}
          >
            {S.viewSatellite}
          </button>
          {activeView === "ground" && (ground?.count ?? 0) > 1 && (
            <button
              onClick={() => setPhotoIndex((i) => (i + 1) % (ground?.count || 1))}
              className="shrink-0 rounded-full border border-white/15 px-2.5 py-1 text-[10px] text-slate-300 hover:bg-white/10"
            >
              ↻ {S.changePhoto}
            </button>
          )}
          <span className="ml-auto min-w-0 truncate text-[9px] text-slate-500">{sourceCredit}</span>
        </div>

        {/* 现在的照片：地面实景优先，卫星兜底 */}
        <div className="relative mx-4 overflow-hidden rounded-xl border border-white/10 bg-[#0b1f3a]">
          <div className="aspect-[900/620] w-full">
            {groundLoading && view === "ground" ? (
              <div className="flex h-full w-full items-center justify-center px-6 text-center text-xs text-slate-400">
                {S.loading}
              </div>
            ) : photoErr ? (
              <div className="flex h-full w-full items-center justify-center px-6 text-center text-xs text-slate-400">
                {S.photoFail}
              </div>
            ) : (
              <img
                src={imgSrc}
                alt={S.photoBadge}
                className="h-full w-full object-cover"
                onLoad={() => setPhotoLoading(false)}
                onError={() => {
                  setPhotoLoading(false);
                  // 地面图失败自动回退卫星，绝不留白
                  if (activeView === "ground") { setView("satellite"); setPhotoErr(false); }
                  else setPhotoErr(true);
                }}
              />
            )}
          </div>
          {(photoLoading || (groundLoading && view === "ground")) && !photoErr && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0b1f3a]/70 text-xs text-slate-300">
              {S.loading}
            </div>
          )}
          <div className="pointer-events-none absolute left-2 top-2 rounded-md bg-[#04101f]/85 px-2 py-1 text-[10px] font-medium text-emerald-300 backdrop-blur-sm">
            ● {S.photoBadge}
          </div>
          <div className="pointer-events-none absolute bottom-2 right-2 rounded bg-black/55 px-1.5 py-0.5 text-[9px] text-slate-200">
            {activeView === "satellite" ? "© Esri" : ground?.source === "Pexels" ? "Pexels" : "Panoramax"}
          </div>
        </div>
        <div className="mx-4 mt-1.5 min-w-0 text-[9px] leading-relaxed text-slate-500">
          <span className="text-slate-400/90">{sourceNote}</span>
          {ground?.kind === "none" && ` · ${S.noGround}`}
        </div>

        {/* 此刻实时信息（走秒时钟） */}
        <div className="grid min-w-0 grid-cols-3 gap-2 px-4 pt-3">
          <Stat label={S.localTime} value={timeShown} sub={meta?.timezoneAbbr || meta?.timezone?.split("/").pop() || ""} />
          <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2.5">
            <div className="break-words text-[10px] uppercase tracking-wider text-slate-400">{S.daylight}</div>
            <div className="mt-1 flex items-center gap-1.5">
              <WeatherGlyph code={w?.code ?? 0} isDay={meta?.isDay ?? true} size={22} />
              <span className="text-base font-semibold leading-tight text-white">
                {meta ? (meta.isDay ? S.day : S.night) : "--"}
              </span>
            </div>
          </div>
          <Stat label={S.weather} value={w ? `${Math.round(w.tempC)}°C` : "--"} sub={weatherLabel} />
        </div>

        {w && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pt-2 text-[10px] text-slate-400">
            <span>{S.feels} {Math.round(w.apparentC)}°C</span>
            <span>{S.wind} {Math.round(w.windKmh)} km/h</span>
            <span>{S.humidity} {Math.round(w.humidity)}%</span>
          </div>
        )}
        {(metaErr || (meta && !meta.live)) && (
          <div className="px-4 pt-2 text-[10px] text-amber-300/90">{S.liveUnavailable}</div>
        )}

        {/* 古今对照：历史发生在这里，这里就是此刻 */}
        <div className="mx-4 mt-3 min-w-0 rounded-xl border border-amber-300/20 bg-amber-300/[0.05] px-3 py-3">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[9px] uppercase tracking-[0.2em] text-slate-400">{S.past}</div>
              <div className="mt-0.5 truncate text-xs text-slate-200">
                {event ? `${event.year < 0 ? `${-event.year} BCE` : event.year} · ${event.title}` : S.noEvent}
              </div>
            </div>
            {years !== null && (
              <div className="shrink-0 text-center">
                <div className="text-lg font-semibold leading-none text-amber-300">{years}</div>
                <div className="mt-0.5 text-[9px] text-slate-400">{S.yearsApart}</div>
              </div>
            )}
            <div className="min-w-0 flex-1 text-right">
              <div className="text-[9px] uppercase tracking-[0.2em] text-emerald-300/80">{S.present}</div>
              <div className="mt-0.5 truncate text-xs text-slate-200">
                {meta?.localDate || new Date().toISOString().slice(0, 10)}
              </div>
              {/* 日期与时间分行：英文模式下一行会被 truncate 截掉秒数 */}
              <div className="truncate text-xs tabular-nums text-slate-200">{timeShown}</div>
            </div>
          </div>
          <p className="editorial mt-2.5 border-t border-white/10 pt-2 text-[12px] leading-snug text-amber-100/80">
            {S.tagline}
          </p>
        </div>

        {/* 换一处地方看此刻 */}
        <div className="px-4 pt-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-400">{S.switchCity}</div>
          <div className="mt-1.5 flex w-full min-w-0 gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {CHIPS.map((c) => {
              const active = Math.abs(c.lat - pt.lat) < 0.001 && Math.abs(c.lon - pt.lon) < 0.001;
              return (
                <button
                  key={c.id}
                  onClick={() => setPt({ lat: c.lat, lon: c.lon, label: zh ? c.zh : c.en })}
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] transition ${
                    active ? "border-emerald-400/60 bg-emerald-400/15 text-emerald-200" : "border-white/15 text-slate-300 hover:bg-white/10"
                  }`}
                >
                  {zh ? c.zh : c.en}
                </button>
              );
            })}
          </div>
        </div>

        {/* 底部：刷新 / 说明 / 署名 */}
        <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-4">
          <button
            onClick={refresh}
            className="shrink-0 rounded-lg border border-white/15 px-3 py-1.5 text-[11px] text-slate-200 hover:bg-white/10 hover:text-white"
          >
            ↻ {S.refresh}
          </button>
          <span className="min-w-0 truncate text-right text-[10px] text-slate-500">{S.taglineShort}</span>
        </div>
        <div className="min-w-0 break-words border-t border-white/10 px-4 py-2.5 text-[9px] leading-relaxed text-slate-500">
          <div>{S.disclaimer}</div>
          <div className="mt-1 text-slate-400/80">{S.credits}</div>
        </div>
      </div>
    </div>
  );
}
