"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Globe, { GlobeEvent, GlobeHeritage } from "@/components/globe/Globe";
import CesiumGlobe, { type GlobeFocus } from "@/components/globe/CesiumGlobe";
import { CATEGORIES, categoryColor } from "@/lib/categories";
import type { CityLayerStatus } from "@/lib/osm-buildings";
import type { CameraState } from "@/lib/ask-yore/types";
import { readShareState, replaceShareState, buildShareUrl, type ShareState } from "@/lib/share";
import { buildDayTour } from "@/lib/tour";
import NowCard, { type NowTarget } from "@/components/explore/NowCard";
import { useI18n } from "@/lib/i18n";

// 一键飞到城市：低空斜视，直接把相机送到能看见 3D 建筑与街道的高度。
const CITY_PRESETS: { id: string; en: string; zh: string; focus: GlobeFocus }[] = [
  { id: "nyc", en: "New York", zh: "纽约", focus: { lat: 40.7128, lon: -74.006, altitude: 700, pitch: -45 } },
  { id: "lon", en: "London", zh: "伦敦", focus: { lat: 51.5074, lon: -0.1278, altitude: 700, pitch: -45 } },
  { id: "par", en: "Paris", zh: "巴黎", focus: { lat: 48.8566, lon: 2.3522, altitude: 700, pitch: -45 } },
  { id: "tok", en: "Tokyo", zh: "东京", focus: { lat: 35.6762, lon: 139.6503, altitude: 700, pitch: -45 } },
  { id: "sha", en: "Shanghai", zh: "上海", focus: { lat: 31.2304, lon: 121.4737, altitude: 700, pitch: -45 } },
  { id: "dxb", en: "Dubai", zh: "迪拜", focus: { lat: 25.2048, lon: 55.2708, altitude: 700, pitch: -45 } },
  { id: "rom", en: "Rome", zh: "罗马", focus: { lat: 41.9028, lon: 12.4964, altitude: 700, pitch: -45 } },
  { id: "hk", en: "Hong Kong, China", zh: "中国香港", focus: { lat: 22.3193, lon: 114.1694, altitude: 700, pitch: -45 } },
];
const GLOBAL_FOCUS: GlobeFocus = { lat: 15, lon: 0, altitude: 28000000, pitch: -90 };

type HistoryEvent = {
  id: string;
  year: number;
  title: string;
  description: string;
  lat: number | null;
  lon: number | null;
  place: string;
  category: string;
  source: "curated" | "wikipedia";
};

type HeritageSite = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  country: string;
  category: string;
  year: number | null;
  image: string | null;
  description: string;
};

const EN_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const ZH_MONTHS = [
  "一月", "二月", "三月", "四月", "五月", "六月",
  "七月", "八月", "九月", "十月", "十一月", "十二月",
];

function fmtDate(m: number, d: number, zh: boolean) {
  return zh ? `${ZH_MONTHS[m - 1]}${d}日` : `${EN_MONTHS[m - 1]} ${d}`;
}
function fmtYear(y: number, zh: boolean) {
  return y < 0 ? (zh ? `公元前${-y}年` : `${-y} BCE`) : `${y}`;
}

export default function ExploreClient() {
  const { t, lang, setLang } = useI18n();
  const zh = lang === "zh";

  // ---- 全部 state 先声明，避免 useMemo/render 期引用尚未初始化的变量 ----
  const [today, setToday] = useState({ m: 1, d: 1 });
  // URL 解析完成前不要按默认 1/1 发请求：否则它会与真实日期的请求竞态，
  // 覆盖事件列表，导致分享链接里的选中事件无法恢复。
  const [dateReady, setDateReady] = useState(false);
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [heritage, setHeritage] = useState<HeritageSite[]>([]);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<HistoryEvent | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [asking, setAsking] = useState(false);
  const [showHeritage, setShowHeritage] = useState(true);
  const [view, setView] = useState<"satellite" | "countries" | "night">("satellite");
  const [dateStr, setDateStr] = useState("");
  const [realEarth, setRealEarth] = useState(false);
  const [realEarthFailed, setRealEarthFailed] = useState(false);
  const [buildings, setBuildings] = useState(true);
  const [cityFocus, setCityFocus] = useState<GlobeFocus | null>(null);
  const [cityStatus, setCityStatus] = useState<CityLayerStatus | null>(null);
  const [tourActive, setTourActive] = useState(false);
  const [tourPaused, setTourPaused] = useState(false);
  const [tourIndex, setTourIndex] = useState(0);
  const [tourFocus, setTourFocus] = useState<GlobeFocus | null>(null);
  const [copied, setCopied] = useState(false);
  // 「此刻此地 / Right Now」：现在的照片 + 此刻实时信息，与历史事件古今同框
  const [nowOpen, setNowOpen] = useState(false);
  const [nowTarget, setNowTarget] = useState<NowTarget>({ lat: 40.7128, lon: -74.006 });

  const params = useSearchParams();
  const pendingEvRef = useRef<string | null>(null);
  const autoTourRef = useRef(false);
  const cameraRef = useRef<CameraState | null>(null);
  // 视线中心地表点（用户真正看到的地点），低空斜视时与相机自身位置不同
  const viewCenterRef = useRef<{ lat: number; lon: number; alt: number } | null>(null);

  // ---- 派生数据 ----
  const placedEvents: GlobeEvent[] = useMemo(
    () =>
      events
        .filter((e) => e.lat != null && e.lon != null)
        .map((e) => ({
          id: e.id,
          year: e.year,
          title: e.title,
          lat: e.lat as number,
          lon: e.lon as number,
          category: e.category,
          place: e.place,
        })),
    [events]
  );

  const heritagePts: GlobeHeritage[] = useMemo(
    () => (showHeritage ? heritage.slice(0, 700).map((h) => ({ id: h.id, name: h.name, lat: h.lat, lon: h.lon })) : []),
    [heritage, showHeritage]
  );

  const tourShots = useMemo(() => buildDayTour(placedEvents), [placedEvents]);

  // 巡游时相机优先按镜头走；否则事件详情优先，其次一键飞到城市
  const focus = useMemo<GlobeFocus | null>(() => {
    if (tourActive && tourFocus) return tourFocus;
    if (detail && detail.lat != null && detail.lon != null) {
      return { lat: detail.lat, lon: detail.lon };
    }
    return cityFocus;
  }, [tourActive, tourFocus, detail, cityFocus]);

  // AskYore 场景上下文：回答前把"用户眼前是什么"一并交给对话层
  const sceneSnapshot = useMemo(
    () => ({
      month: today.m,
      day: today.d,
      lang,
      view,
      realEarth,
      selectedEventId: detail?.id ?? null,
      events: events.slice(0, 40).map((e) => ({
        id: e.id,
        year: e.year,
        title: e.title,
        place: e.place,
        category: e.category,
        lat: e.lat,
        lon: e.lon,
      })),
    }),
    [today, lang, view, realEarth, detail, events]
  );

  // ---- 回调 ----
  const fetchEvents = useCallback(async (m: number, d: number) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/events?month=${m}&day=${d}`);
      const data = await r.json();
      setEvents(data.events || []);
      setDetail(null);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHeritage = useCallback(async () => {
    try {
      const r = await fetch(`/api/heritage`);
      const data = await r.json();
      setHeritage(data.sites || []);
    } catch {
      setHeritage([]);
    }
  }, []);

  const onDateChange = (v: string) => {
    setDateStr(v);
    if (!v) return;
    const [, mm, dd] = v.split("-").map(Number);
    if (mm && dd) setToday({ m: mm, d: dd });
  };

  const askHistoria = async () => {
    if (!today.m) return;
    setAsking(true);
    setAnswer("");
    try {
      const r = await fetch(`/api/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: today.m,
          day: today.d,
          question,
          scene: {
            ...sceneSnapshot,
            camera: cameraRef.current,
            tour: tourActive ? { active: true, index: tourIndex, total: tourShots.length } : null,
          },
        }),
      });
      const data = await r.json();
      setAnswer(data.answer || "No answer.");
    } catch {
      setAnswer("Something went wrong reaching Historia.");
    } finally {
      setAsking(false);
    }
  };

  const startTour = () => {
    if (!tourShots.length) return;
    setRealEarth(true);
    setTourIndex(0);
    setTourPaused(false);
    setTourActive(true);
  };
  const stopTour = () => {
    setTourActive(false);
    setTourPaused(false);
    setTourFocus(null);
    setTourIndex(0);
  };
  const shareView = async () => {
    const url = buildShareUrl({
      month: today.m,
      day: today.d,
      lang,
      view,
      realEarth,
      selectedEventId: detail?.id ?? null,
      camera: cameraRef.current,
      tour: tourActive,
    });
    let ok = false;
    try {
      await navigator.clipboard.writeText(url);
      ok = true;
    } catch {}
    if (!ok) {
      try {
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {}
    }
    setCopied(ok);
    setTimeout(() => setCopied(false), 2600);
  };
  const flyTo = (f: GlobeFocus) => {
    stopTour();
    setDetail(null);
    setCityFocus(f);
  };

  // 未选中事件时，用「这一天第一个带坐标的事件」作为此刻的地点与古今对照锚点。
  // 例如只把日期切到 10/1、不点任何事件，也应落在天安门，而不是默认城市。
  const dayAnchor = detail ?? events.find((e) => e.lat != null && e.lon != null) ?? null;

  // 「此刻此地」：确定要拍哪一处的"现在"。
  // 优先选中事件 → 当天代表事件 → 用户真正看到的地表点 → 城市 → 默认坐标。
  const openNow = () => {
    const vc = viewCenterRef.current;
    const cam = cameraRef.current;
    let t: NowTarget = { lat: 40.7128, lon: -74.006 };
    if (dayAnchor && dayAnchor.lat != null && dayAnchor.lon != null) {
      t = { lat: dayAnchor.lat, lon: dayAnchor.lon, label: dayAnchor.place ?? undefined };
    } else if (vc && cam && cam.alt < 5_000_000) {
      t = { lat: vc.lat, lon: vc.lon };
    } else if (cityFocus) {
      t = { lat: cityFocus.lat, lon: cityFocus.lon };
    }
    setNowTarget(t);
    setNowOpen(true);
  };

  // ---- effects ----
  // 分享链接恢复：日期、语言、视图、真实地球、选中事件、相机、自动巡游。
  // 只读取本模块自己的键，sharecode / hgdebug 等参数原样留在 URL 上。
  useEffect(() => {
    const s = readShareState(params.toString());
    const n = new Date();
    const m = s.month ?? n.getMonth() + 1;
    const d = s.day ?? n.getDate();
    setToday({ m, d });
    setDateStr(`${n.getFullYear()}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    if (s.lang) setLang(s.lang);
    if (s.view) setView(s.view);
    if (s.realEarth !== undefined) setRealEarth(s.realEarth);
    if (s.selectedEventId) pendingEvRef.current = s.selectedEventId;
    if (s.camera) {
      cameraRef.current = s.camera;
      setCityFocus({
        lat: s.camera.lat,
        lon: s.camera.lon,
        altitude: s.camera.alt,
        pitch: s.camera.pitch,
        heading: s.camera.heading,
      });
    }
    if (s.tour) autoTourRef.current = true;
    setDateReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, setLang]);

  useEffect(() => {
    fetchHeritage();
  }, [fetchHeritage]);

  useEffect(() => {
    if (dateReady && today.m && today.d) fetchEvents(today.m, today.d);
  }, [today, dateReady, fetchEvents]);

  // 事件加载完成后，恢复分享链接里的选中事件 / 自动开始巡游。
  // 只有真正找到该事件才清除待恢复 id：若上游返回的是别的日期的数据，
  // 保留 ref 等正确那批事件到达，避免竞态把 id 吞掉。
  useEffect(() => {
    if (pendingEvRef.current && events.length) {
      const e = events.find((x) => x.id === pendingEvRef.current);
      if (e) {
        setDetail(e);
        pendingEvRef.current = null;
      }
    }
    if (autoTourRef.current && events.length && dateReady) {
      autoTourRef.current = false;
      setTourIndex(0);
      setTourPaused(false);
      setTourActive(true);
    }
  }, [events, dateReady]);

  // 逐个镜头推进：设置详情 + 相机，停留后进入下一镜头
  useEffect(() => {
    if (!tourActive || tourPaused || !tourShots.length) return;
    const shot = tourShots[tourIndex];
    if (!shot) {
      setTourActive(false);
      setTourFocus(null);
      return;
    }
    if (shot.eventId) {
      const ev = events.find((x) => x.id === shot.eventId);
      setDetail(ev || null);
    } else {
      setDetail(null);
    }
    setTourFocus(shot.camera);
    const timer = setTimeout(() => {
      setTourIndex((i) => i + 1);
    }, (shot.durationSec + shot.holdSec) * 1000);
    return () => clearTimeout(timer);
  }, [tourActive, tourPaused, tourIndex, tourShots, events]);

  // URL 原地同步：不触发 Next 路由跳转，也不丢 sharecode
  useEffect(() => {
    if (!today.m) return;
    const s: ShareState = {
      month: today.m,
      day: today.d,
      lang,
      view,
      realEarth,
      selectedEventId: detail?.id ?? null,
      camera: cameraRef.current,
      tour: tourActive,
    };
    replaceShareState(s);
  }, [today, lang, view, realEarth, detail, tourActive]);

  const currentShot = tourShots[Math.min(tourIndex, Math.max(0, tourShots.length - 1))];

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col lg:flex-row">
      {/* Globe */}
      <div className="relative shrink-0 h-[44vh] min-h-[260px] lg:h-auto lg:flex-1 bg-[radial-gradient(1200px_700px_at_70%_-10%,rgba(56,189,248,0.08),transparent_55%)]">
        {realEarth ? (
          <CesiumGlobe
            events={placedEvents}
            heritage={heritagePts}
            view={view}
            focus={focus}
            lang={lang}
            buildings={buildings}
            onCityStatus={setCityStatus}
            onCameraChange={(c) => { cameraRef.current = c; }}
            onViewCenter={(v) => { viewCenterRef.current = v; }}
            onFatalError={() => {
              setRealEarth(false);
              setRealEarthFailed(true);
              setTimeout(() => setRealEarthFailed(false), 5000);
            }}
            onSelect={(e) => {
              const full = events.find((x) => x.id === e.id);
              if (full) setDetail(full);
            }}
          />
        ) : (
          <Globe events={placedEvents} heritage={heritagePts} view={view} focus={focus} lang={lang} onSelect={(e) => {
            const full = events.find((x) => x.id === e.id);
            if (full) setDetail(full);
          }} height={300} />
        )}
        {realEarthFailed && (
          <div className="absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-lg bg-amber-500/90 px-3 py-1.5 text-xs font-medium text-[#04101f] shadow-lg">
            真实地球在当前设备无法渲染，已切回经典地球
          </div>
        )}
        {realEarth && (
          <>
            {/* 3D 街区加载状态：让用户明确知道是"正在加载 / 已加载 / 数据源不可达" */}
            {cityStatus && cityStatus.state !== "off" && (
              <div className="pointer-events-none absolute left-3 top-3 z-10 max-w-[70%] rounded-lg bg-[#04101f]/80 px-2.5 py-1.5 text-[10px] leading-tight text-slate-200 backdrop-blur-sm">
                {cityStatus.state === "imagery" &&
                  (lang === "zh"
                    ? `连续卫星影像 · 高度 ${Math.round(cityStatus.height)}m · 放大到 3km 内出现 3D 建筑`
                    : `Continuous imagery · ${Math.round(cityStatus.height)}m · zoom below 3km for 3D buildings`)}
                {cityStatus.state === "loading" &&
                  (lang === "zh" ? "正在加载 3D 建筑…" : "Loading 3D buildings…")}
                {cityStatus.state === "ready" &&
                  (lang === "zh"
                    ? `3D 建筑已加载 · ${cityStatus.buildings} 栋 · 高度 ${Math.round(cityStatus.height)}m`
                    : `3D buildings ready · ${cityStatus.buildings} · ${Math.round(cityStatus.height)}m`)}
                {cityStatus.state === "error" &&
                  (lang === "zh" ? "3D 建筑数据源暂不可达，请稍后重试" : "3D building source unreachable, retry later")}
                {cityStatus.state === "empty" &&
                  (lang === "zh" ? "该区域暂无建筑数据，换个城市试试" : "No building data here, try another city")}
              </div>
            )}
            {/* 巡游进度浮层 */}
            {tourActive && (
              <div className="pointer-events-none absolute left-3 top-12 z-10 max-w-[76%] rounded-lg bg-[#04101f]/85 px-2.5 py-1.5 text-[10px] leading-tight text-sky-200 backdrop-blur-sm">
                {lang === "zh" ? "镜头巡游" : "Day tour"} · {Math.min(tourIndex + 1, tourShots.length)}/{tourShots.length}
                {tourPaused ? (lang === "zh" ? " · 已暂停" : " · paused") : ""}
                {currentShot?.title ? ` · ${currentShot.year ?? ""} ${currentShot.title}` : ""}
              </div>
            )}
            {/* 一键飞到城市：手动从全球放大很难精确落到街区级，这个入口保证看得见 */}
            <div className="absolute bottom-7 left-0 right-0 z-10 flex gap-1.5 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button
                onClick={() => flyTo(GLOBAL_FOCUS)}
                className="shrink-0 rounded-full border border-emerald-400/40 bg-[#04101f]/80 px-2.5 py-1 text-[10px] font-medium text-emerald-300 backdrop-blur-sm"
              >
                {lang === "zh" ? "全球" : "Globe"}
              </button>
              {CITY_PRESETS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => flyTo(c.focus)}
                  className="shrink-0 rounded-full border border-white/15 bg-[#04101f]/80 px-2.5 py-1 text-[10px] text-slate-200 backdrop-blur-sm hover:bg-sky-500/80 hover:text-[#04101f]"
                >
                  {lang === "zh" ? c.zh : c.en}
                </button>
              ))}
            </div>
          </>
        )}
        <div className="pointer-events-none absolute left-4 bottom-4 hidden md:block">
          <div className="glass rounded-xl px-3 py-2 text-[11px] text-slate-300">
            <span className="text-heritage">●</span> {t("explore.legendHeritage")} &nbsp;
            <span className="text-sky-400">●</span> {t("explore.legendEvents")}
            <div className="mt-1 text-slate-400">{t("explore.legendHint")}</div>
          </div>
        </div>
        <div className="absolute right-4 top-4 flex flex-wrap items-center justify-end gap-2">
          <div className="glass flex items-center gap-0.5 rounded-lg p-0.5 text-xs">
            {([
              ["satellite", t("explore.viewSatellite")],
              ["countries", t("explore.viewCountries")],
              ["night", t("explore.viewNight")],
            ] as const).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-md px-2.5 py-1 transition ${
                  view === v ? "bg-sky-500 text-[#04101f] font-semibold" : "text-slate-300 hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setRealEarth((r) => !r)}
            className={`glass rounded-lg px-3 py-1.5 text-xs transition ${
              realEarth ? "bg-emerald-500/90 text-[#04101f] font-semibold" : "text-slate-200 hover:text-white"
            }`}
            title="切换真实地球（Cesium · 连续卫星影像 + OSM 3D 建筑 · 套餐 B 免费商用数据源）"
          >
            真实地球 β
          </button>
          {/* 活在当下：一眼看到这个地点现在的样子 */}
          <button
            onClick={openNow}
            className="rounded-lg bg-gradient-to-r from-emerald-400 to-sky-400 px-3 py-1.5 text-xs font-semibold text-[#04101f] shadow-lg shadow-emerald-500/20 transition hover:brightness-110"
            title={lang === "zh" ? "此刻此地：这个地点现在的地面实景照片 + 此刻当地时间/天气，与历史古今同框" : "Right Now: today's ground-level photos of this place + live local time/weather, alongside its history"}
          >
            ● {lang === "zh" ? "此刻此地" : "Right Now"}
          </button>
          {realEarth && (
            <label
              className="glass flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-slate-200 cursor-pointer"
              title="低空（3km 内）自动浮现真实 OSM 3D 建筑（OpenFreeMap，免费商用）；地面为连续卫星影像"
            >
              <input
                type="checkbox"
                checked={buildings}
                onChange={(e) => setBuildings(e.target.checked)}
                className="accent-emerald-400"
              />
              {lang === "zh" ? "3D 建筑" : "3D Buildings"}
            </label>
          )}
          <label
            className="glass flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-slate-200 cursor-pointer"
            title={
              lang === "zh"
                ? "世界遗产点位：全球视角自动隐藏，放大到区域级后才逐层显示；取消勾选可完全关闭"
                : "Heritage sites are hidden at global view and revealed as you zoom in; uncheck to disable entirely"
            }
          >
            <input
              type="checkbox"
              checked={showHeritage}
              onChange={(e) => setShowHeritage(e.target.checked)}
              className="accent-amber-400"
            />
            {t("explore.worldHeritage")}
          </label>
          <input
            type="date"
            value={dateStr}
            onChange={(e) => onDateChange(e.target.value)}
            className="glass rounded-lg px-3 py-1.5 text-xs text-slate-100 bg-transparent outline-none [color-scheme:dark]"
          />
        </div>
        <div
          title={
            realEarth
              ? "数据来源 · © Esri World Imagery（连续卫星影像 / 卫星俯视兜底，经本站同源代理按需转发）· Pexels（地标地面实景，Pexels License）· Panoramax（地面街景，CC BY-SA 4.0，署名作者/拍摄日期）· © OpenMapTiles · Data from © OpenStreetMap contributors（低空 3D 建筑，ODbL，仅流式渲染不落盘）· OpenFreeMap（免费商用瓦片）· Open-Meteo（实时天气/当地时间，CC BY 4.0）· Natural Earth（国界/城市，公共领域）· CesiumJS（Apache-2.0）"
              : "数据来源 · NASA（Blue/Black Marble）· Natural Earth（国界/城市，公共领域）· Wikidata 等公开史料"
          }
          className="pointer-events-none absolute bottom-1 left-1/2 w-[94%] -translate-x-1/2 truncate text-center text-[9px] leading-tight text-slate-400/60"
        >
          {realEarth
            ? "© Esri · Pexels · Panoramax (CC BY-SA 4.0) · © OpenMapTiles · © OpenStreetMap contributors (ODbL) · OpenFreeMap · Open-Meteo (CC BY 4.0) · Natural Earth · CesiumJS"
            : "数据来源 · NASA（Blue/Black Marble）· Natural Earth（国界/城市，公共领域）· Wikidata 等公开史料"}
        </div>
      </div>

      {/* Panel */}
      <aside className="w-full lg:w-[400px] flex-1 lg:flex-none lg:shrink-0 border-t lg:border-t-0 lg:border-l border-white/10 bg-card/40 overflow-y-auto">
        <div className="px-5 pt-5 pb-3 border-b border-white/10">
          <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">{t("explore.exploring")}</div>
          <h2 className="editorial text-2xl text-white mt-1">{fmtDate(today.m, today.d, zh)}</h2>
          <p className="text-xs text-slate-400 mt-1">
            {t("explore.eventsRecorded", { n: events.length, m: placedEvents.length })}
          </p>
        </div>

        {/* 镜头巡游 + 分享链接 */}
        <div className="px-5 py-3 border-b border-white/10">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={tourActive ? stopTour : startTour}
              disabled={!tourShots.length}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-40 ${
                tourActive
                  ? "bg-amber-400/90 text-[#04101f]"
                  : "bg-sky-500/90 hover:bg-sky-400 text-[#04101f]"
              }`}
              title={lang === "zh" ? "按年份依次飞过当天有坐标的历史事件" : "Fly through the day's geolocated events in chronological order"}
            >
              {tourActive
                ? (lang === "zh" ? "停止巡游" : "Stop tour")
                : (lang === "zh" ? "巡游这一天" : "Tour this day")}
            </button>
            {tourActive && (
              <button
                onClick={() => setTourPaused((p) => !p)}
                className="glass rounded-lg px-3 py-1.5 text-xs text-slate-200"
              >
                {tourPaused ? (lang === "zh" ? "继续" : "Resume") : (lang === "zh" ? "暂停" : "Pause")}
              </button>
            )}
            <button
              onClick={shareView}
              className="glass rounded-lg px-3 py-1.5 text-xs text-slate-200 hover:text-white"
              title={lang === "zh" ? "复制可还原当前日期、视角与选中事件的链接" : "Copy a link that restores this date, view and selected event"}
            >
              {lang === "zh" ? "复制分享链接" : "Copy share link"}
            </button>
            <button
              onClick={openNow}
              className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-400/20"
              title={lang === "zh" ? "看看这个地点现在的样子，与历史古今同框" : "See this place right now, alongside its history"}
            >
              ● {lang === "zh" ? "活在当下 · 看现在的样子" : "Right Now · see it today"}
            </button>
          </div>
          {tourActive && tourShots.length > 0 && (
            <div className="mt-2 text-[11px] text-sky-300 leading-snug">
              {lang === "zh" ? "镜头" : "Shot"} {Math.min(tourIndex + 1, tourShots.length)}/{tourShots.length}
              {tourPaused ? (lang === "zh" ? " · 已暂停" : " · paused") : ""}
              {currentShot?.title ? ` · ${currentShot.year ?? ""} ${currentShot.title}` : ""}
            </div>
          )}
          {copied && (
            <div className="mt-2 text-[11px] text-emerald-300">
              {lang === "zh" ? "链接已复制，打开即可还原这一刻" : "Link copied — opening it restores this exact view"}
            </div>
          )}
          <div className="mt-2 text-[10px] leading-snug text-slate-500">
            {lang === "zh"
              ? `对话已注入场景：${fmtDate(today.m, today.d, true)} · ${events.length} 条事件 · ${view} · 12 个白名单工具 · $5 会话硬顶`
              : `Scene grounded: ${fmtDate(today.m, today.d, false)} · ${events.length} events · ${view} · 12 whitelisted tools · $5 session cap`}
          </div>
        </div>

        {/* Event list */}
        <div className="px-3 py-2 space-y-1">
          {loading && <div className="text-xs text-slate-400 px-2 py-4">{t("explore.loading")}</div>}
          {!loading && events.length === 0 && (
            <div className="text-xs text-slate-400 px-2 py-6 leading-relaxed">
              {t("explore.empty")}
            </div>
          )}
          {events.map((e) => (
            <button
              key={e.id}
              onClick={() => setDetail(e)}
              className={`w-full text-left rounded-xl px-3 py-2.5 transition border ${
                detail?.id === e.id ? "bg-white/5 border-sky-400/40" : "border-transparent hover:bg-white/5"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <span
                  className="mt-1 h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ background: categoryColor(e.category) }}
                />
                <div className="min-w-0">
                  <div className="text-sm text-white font-medium leading-snug">{e.title}</div>
                  <div className="text-[11px] text-slate-400 mt-1 flex flex-wrap gap-x-2">
                    <span className="text-sky-300 font-semibold">{fmtYear(e.year, zh)}</span>
                    <span>{e.place || t("explore.locationNotPinned")}</span>
                    <span className="text-slate-500">· {t(`category.${e.category}`)}</span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Detail */}
        {detail && (
          <div className="mx-3 mb-3 rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: categoryColor(detail.category) }} />
              <span className="text-[11px] uppercase tracking-wider text-slate-400">{t(`category.${detail.category}`)}</span>
              {detail.source === "wikipedia" && (
                <span className="text-[10px] text-slate-500 border border-white/10 rounded px-1.5 py-0.5">{t("explore.wikipediaTag")}</span>
              )}
            </div>
            <h3 className="editorial text-lg text-white leading-snug">{detail.title}</h3>
            <div className="text-xs text-sky-300 font-semibold mt-1">{fmtYear(detail.year, zh)} · {detail.place || t("explore.locationNotPinned")}</div>
            <p className="text-sm text-slate-300 leading-relaxed mt-2">{detail.description}</p>
          </div>
        )}

        {/* 活在当下：一眼看到这个地点现在的样子（与历史事件古今同框） */}
        <button
          onClick={openNow}
          className="mx-3 mb-4 flex w-[calc(100%-1.5rem)] items-center gap-3 rounded-xl border border-emerald-400/25 bg-gradient-to-r from-emerald-400/[0.08] to-sky-400/[0.06] px-4 py-3 text-left transition hover:border-emerald-400/50 hover:from-emerald-400/[0.14]"
        >
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold text-emerald-100">
              {lang === "zh" ? "此刻此地 · 看看现在的样子" : "Right Now · see this place today"}
            </span>
            <span className="mt-0.5 block text-[10px] leading-snug text-slate-400">
              {lang === "zh"
                ? "现在的地面实景照片 + 此刻当地时间 / 天气，与历史事件古今同框。主题不只是对话历史，更要活在当下。"
                : "Today's aerial imagery + live local time & weather, next to the history. Not only the past — this place, right now."}
            </span>
          </span>
          <span className="shrink-0 text-emerald-300/80">→</span>
        </button>

        {/* Ask Historia */}
        <div className="mx-3 mb-6 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-[11px] uppercase tracking-[0.2em] text-amber-300/80">{t("explore.askHistoria")}</div>
          <p className="text-xs text-slate-400 mt-1 mb-2">
            {t("explore.askIntro", { date: fmtDate(today.m, today.d, zh) })}
          </p>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={2}
            placeholder={t("explore.askPlaceholder")}
            className="w-full resize-none rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400/50"
          />
          <button
            onClick={askHistoria}
            disabled={asking}
            className="mt-2 w-full rounded-lg bg-sky-500 hover:bg-sky-400 text-[#04101f] font-semibold text-sm py-2 transition disabled:opacity-50"
          >
            {asking ? t("explore.weaving") : t("explore.askButton")}
          </button>
          {answer && (
            <div className="mt-3 rounded-lg bg-amber-400/5 border border-amber-400/20 p-3">
              <div className="text-[10px] uppercase tracking-wider text-amber-300/70 mb-1">Historia</div>
              <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">{answer}</p>
            </div>
          )}
        </div>
      </aside>

      {/* 「此刻此地」浮层：现在的照片 + 此刻实时信息，与历史事件古今同框 */}
      {nowOpen && (
        <NowCard
          target={nowTarget}
          lang={lang}
          event={dayAnchor ? { year: dayAnchor.year, title: dayAnchor.title, place: dayAnchor.place ?? undefined } : null}
          onClose={() => setNowOpen(false)}
        />
      )}
    </div>
  );
}
