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
import HistoricalBoundaryControl from "@/components/explore/HistoricalBoundaryControl";
import { boundaryUrlForYear, sliderYears } from "@/lib/historical-boundaries";
import { useI18n } from "@/lib/i18n";
import { track } from "@/components/funnel";

/** AI 回答的逐条出处（对应 /api/ask 返回的 sources）。 */
type AskSource = { n: number; title: string; year: number; place: string; url: string; source: string };

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
  source: "curated" | "wikipedia" | "wikidata" | "domain";
  /** 可点击的权威出处，来自服务端；任何事件都应当能一键溯源。 */
  sourceUrl?: string;
};

type DaySources = {
  curated: number;
  wikipedia: number;
  wikidata: number;
  domain: number;
  live: boolean;
};

type SavedPlace = {
  id: string;
  title: string;
  year: number;
  place: string;
  lat: number | null;
  lon: number | null;
  sourceUrl?: string;
  month: number;
  day: number;
};

const SAVED_KEY = "hg-saved-places";

function readSaved(): SavedPlace[] {
  if (typeof window === "undefined") return [];
  try {
    const v = JSON.parse(window.localStorage.getItem(SAVED_KEY) || "[]");
    return Array.isArray(v) ? v.slice(0, 200) : [];
  } catch {
    return [];
  }
}

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
  const [askSources, setAskSources] = useState<AskSource[]>([]);
  const [askError, setAskError] = useState("");
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
  // P0/P1/P2 新增：数据密度诚实提示、真实地球加载态、类别筛选、收藏时间线、定位与导出反馈
  const [daySources, setDaySources] = useState<DaySources | null>(null);
  const [earthLoading, setEarthLoading] = useState(false);
  const [earthProgress, setEarthProgress] = useState<{ remaining: number; phase: string } | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedPlace[]>([]);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [flash, setFlash] = useState("");
  // 历史国界时间轴：off 时用现代 Natural Earth 基线；on 时按真实面板年加载边界
  const [boundaryOn, setBoundaryOn] = useState(false);
  const [boundaryYear, setBoundaryYear] = useState<number>(1000);
  const boundaryUrl = useMemo(
    () => (boundaryOn ? (boundaryUrlForYear(boundaryYear) ?? undefined) : undefined),
    [boundaryOn, boundaryYear]
  );

  const params = useSearchParams();
  const pendingEvRef = useRef<string | null>(null);
  const autoTourRef = useRef(false);
  const cameraRef = useRef<CameraState | null>(null);
  // 视线中心地表点（用户真正看到的地点），低空斜视时与相机自身位置不同
  const viewCenterRef = useRef<{ lat: number; lon: number; alt: number } | null>(null);

  // ---- 派生数据 ----
  // 类别筛选是定价页宣称、此前未落地的功能：同时作用于事件列表与地球点位。
  const visibleEvents = useMemo(
    () => (categoryFilter ? events.filter((e) => e.category === categoryFilter) : events),
    [events, categoryFilter]
  );
  const availableCategories = useMemo(
    () => Array.from(new Set(events.map((e) => e.category))).filter((c) => !!CATEGORIES[c]),
    [events]
  );

  const placedEvents: GlobeEvent[] = useMemo(
    () =>
      visibleEvents
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
    [visibleEvents]
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
      events: visibleEvents.slice(0, 40).map((e) => ({
        id: e.id,
        year: e.year,
        title: e.title,
        place: e.place,
        category: e.category,
        lat: e.lat,
        lon: e.lon,
      })),
    }),
    [today, lang, view, realEarth, detail, visibleEvents]
  );

  // ---- 回调 ----
  const showFlash = useCallback((msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(""), 3200);
  }, []);

  const eventsReqRef = useRef(0);
  const fetchEvents = useCallback(async (m: number, d: number) => {
    // 日期快速切换时，旧请求（Wikipedia 上游可能 6s+）会晚于新请求返回并覆盖结果，
    // 导致"日期显示 7/20、事件却是 11/7"的错乱。只接受最新一次请求的数据。
    const seq = ++eventsReqRef.current;
    setLoading(true);
    try {
      const r = await fetch(`/api/events?month=${m}&day=${d}`);
      const data = await r.json();
      if (seq !== eventsReqRef.current) return;
      setEvents(data.events || []);
      setDaySources(data.sources || null);
      setDetail(null);
    } catch {
      if (seq !== eventsReqRef.current) return;
      setEvents([]);
      setDaySources(null);
    } finally {
      if (seq === eventsReqRef.current) setLoading(false);
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
    setAskSources([]);
    setAskError("");
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
      // 配额护栏拒绝时给出明确提示，而不是把错误信息当作回答显示
      if (!r.ok || data.error) {
        setAskError(data.message || "Historia is unavailable right now.");
        return;
      }
      setAnswer(data.answer || "No answer.");
      setAskSources(Array.isArray(data.sources) ? data.sources : []);
    } catch {
      setAskError("Something went wrong reaching Historia.");
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
  const dayAnchor = detail ?? visibleEvents.find((e) => e.lat != null && e.lon != null) ?? null;

  // 「回到那一刻」：任意事件都播放同一套「真实照片幻灯片」。
  // 只传事件元数据 —— 服务端按需返回自由授权史料照片清单，不预生成 / 预存任何视频。
  const reelHrefFor = (e: HistoryEvent) => {
    const p = new URLSearchParams();
    p.set("e", e.title);
    p.set("y", String(e.year));
    p.set("place", e.place || "");
    p.set("cat", e.category || "");
    p.set("id", e.id || "");
    p.set("lang", lang);
    p.set("m", String(today.m));
    p.set("d", String(today.d));
    if (e.lat != null) p.set("lat", String(e.lat));
    if (e.lon != null) p.set("lon", String(e.lon));
    if (/开国|大典|国庆|天安门/.test(e.title) || (today.m === 10 && today.d === 1)) p.set("q", "10.1");
    else if (/\b9\/?11\b|\b911\b|世贸|双塔|双子塔|world trade center|\bwtc\b|ground zero/i.test(`${e.title} ${e.place}`)) p.set("q", "911");
    return "/reel.html?" + p.toString();
  };
  const reelTarget = detail ?? dayAnchor ?? visibleEvents[0] ?? null;

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

  /** 旅行者的真实需求：不是「事件发生地此刻」，而是「我脚下此刻」。 */
  const locateMe = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      showFlash(t("explore.locateFail"));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setNowTarget({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          label: lang === "zh" ? "我的位置" : "My location",
        });
        setNowOpen(true);
        showFlash(t("explore.locateOk"));
      },
      () => {
        setLocating(false);
        showFlash(t("explore.locateFail"));
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  };

  /** CSV 导出：含可核查的出处链接，供教师做课件、研究者做引用。 */
  const exportCsv = () => {
    track("export_csv", { label: `${today.m}-${today.d}` });
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const head = ["year", "title", "place", "category", "lat", "lon", "source", "sourceUrl", "month", "day"];
    const rows = visibleEvents.map((e) => [
      e.year, e.title, e.place, e.category, e.lat, e.lon, e.source, e.sourceUrl, today.m, today.d,
    ]);
    const csv = "\uFEFF" + [head.join(","), ...rows.map((r) => r.map(esc).join(","))].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `historia-${today.m}-${today.d}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showFlash(t("explore.exportDone", { n: rows.length }));
  };

  /** 收藏地点 → 跨日期的个人时间线（localStorage，无需账号）。 */
  const toggleSave = (e: HistoryEvent) => {
    setSaved((prev) => {
      const exists = prev.some((s) => s.id === e.id);
      const next = exists
        ? prev.filter((s) => s.id !== e.id)
        : [
            {
              id: e.id, title: e.title, year: e.year, place: e.place,
              lat: e.lat, lon: e.lon, sourceUrl: e.sourceUrl,
              month: today.m, day: today.d,
            },
            ...prev,
          ].slice(0, 200);
      try { window.localStorage.setItem(SAVED_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const removeSaved = (id: string) => {
    setSaved((prev) => {
      const next = prev.filter((s) => s.id !== id);
      try { window.localStorage.setItem(SAVED_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const sourceLabel = (s: HistoryEvent["source"]) =>
    s === "wikipedia" ? t("explore.sourceWikipedia")
      : s === "wikidata" ? t("explore.sourceWikidata")
      : s === "domain" ? t("explore.sourceDomain")
      : t("explore.sourceCurated");

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
    setSaved(readSaved());
  }, [fetchHeritage]);

  // 切到真实地球时先显示明确加载态，等 Cesium 首帧影像瓦片到位再撤掉。
  useEffect(() => {
    setEarthLoading(realEarth);
  }, [realEarth]);

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
      <div className="hg-globe-area relative shrink-0 h-[44vh] min-h-[260px] lg:h-auto lg:flex-1 bg-[radial-gradient(1200px_700px_at_70%_-10%,rgba(56,189,248,0.08),transparent_55%)]">
        {realEarth ? (
          <CesiumGlobe
            events={placedEvents}
            heritage={heritagePts}
            view={view}
            focus={focus}
            lang={lang}
            boundaryUrl={boundaryUrl}
            buildings={buildings}
            onCityStatus={setCityStatus}
            onImageryReady={() => { setEarthLoading(false); setEarthProgress(null); }}
            onImageryProgress={(p) => setEarthProgress(p)}
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
          <Globe events={placedEvents} heritage={heritagePts} view={view} focus={focus} lang={lang} boundaryUrl={boundaryUrl} onSelect={(e) => {
            const full = events.find((x) => x.id === e.id);
            if (full) setDetail(full);
          }} height={300} />
        )}
        {realEarthFailed && (
          <div className="absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-lg bg-amber-500/90 px-3 py-1.5 text-xs font-medium text-[#04101f] shadow-lg">
            真实地球在当前设备无法渲染，已切回经典地球
          </div>
        )}
        {/* 首次切换真实地球：本地地球贴图已即时铺底，这里只显示轻量进度条，
            不再是全屏黑色遮罩。Esri 瓦片逐块覆盖，首个瓦片到位即撤掉。 */}
        {realEarth && earthLoading && (
          <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center">
            <div className="glass flex max-w-[86%] items-center gap-3 rounded-xl px-4 py-2.5 text-center">
              <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-400" />
              </span>
              <div className="text-left">
                <div className="text-xs font-semibold text-white">{t("explore.earthLoading")}</div>
                <div className="text-[10px] text-slate-400">
                  {earthProgress?.phase === "progress"
                    ? (lang === "zh" ? "卫星影像正在覆盖占位地球…" : "Satellite imagery covering the placeholder globe…")
                    : (lang === "zh" ? "已显示本地地球底图，正在连接 Esri 影像" : "Local globe shown, connecting to Esri imagery")}
                  {" · © Esri"}
                </div>
              </div>
            </div>
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
            {t("explore.eventsRecorded", { n: visibleEvents.length, m: placedEvents.length })}
          </p>
        </div>

        {/* 数据口径说明：地球点位来自策展层，完整文字记录在日期页。
            用低调中性样式，避免被误读成"站点故障"警告。 */}
        {daySources && !daySources.live && events.length > 0 && (
          <div className="mx-3 mt-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] leading-relaxed text-slate-400">
            {t("explore.sourcesOffline", { n: daySources.curated })}
          </div>
        )}
        {flash && (
          <div className="mx-3 mt-3 rounded-lg border border-emerald-400/25 bg-emerald-400/[0.07] px-3 py-2 text-[11px] text-emerald-200">
            {flash}
          </div>
        )}

        {/* 历史国界时间轴：真实面板年 + 逐层出处，切换只替换地球边界图层 */}
        <HistoricalBoundaryControl
          lang={lang === "zh" ? "zh" : "en"}
          enabled={boundaryOn}
          year={boundaryYear}
          onToggle={(on) => {
            setBoundaryOn(on);
            // 两个地球都只在 "countries" 视图绘制国界；打开时间轴时自动切过去，
            // 否则用户会看到「切了年份但地球没变化」。用户之后仍可手动切回卫星视图。
            if (on) setView("countries");
          }}
          onChangeYear={setBoundaryYear}
        />

        {/* 类别筛选（此前只在定价页文案里出现，现在真实作用于列表与地球点位） */}
        {availableCategories.length > 0 && (
          <div className="px-3 pt-3">
            <div className="mb-1.5 text-[10px] uppercase tracking-wider text-slate-500">
              {t("explore.categoryFilter")}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setCategoryFilter(null)}
                className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                  categoryFilter === null
                    ? "border-sky-400/60 bg-sky-500/20 text-sky-200"
                    : "border-white/10 text-slate-400 hover:text-white"
                }`}
              >
                {t("explore.categoryAll")} · {events.length}
              </button>
              {availableCategories.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategoryFilter(categoryFilter === c ? null : c)}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition ${
                    categoryFilter === c
                      ? "border-sky-400/60 bg-sky-500/20 text-sky-200"
                      : "border-white/10 text-slate-400 hover:text-white"
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: categoryColor(c) }} />
                  {t(`category.${c}`)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 教师 / 研究者工具条：导出可引用数据、跨日期个人时间线、GPS 定位 */}
        <div className="flex flex-wrap items-center gap-2 px-3 pt-3">
          <button
            onClick={exportCsv}
            disabled={!visibleEvents.length}
            className="glass rounded-lg px-3 py-1.5 text-[11px] text-slate-200 transition hover:text-white disabled:opacity-40"
            title={lang === "zh" ? "导出当天事件（含出处链接与坐标）为 CSV" : "Export this day's events with source URLs as CSV"}
          >
            ⇩ {t("explore.exportCsv")}
          </button>
          <button
            onClick={() => setTimelineOpen((v) => !v)}
            className="glass rounded-lg px-3 py-1.5 text-[11px] text-slate-200 transition hover:text-white"
          >
            ☆ {t("explore.timeline")} · {saved.length}
          </button>
          <button
            onClick={locateMe}
            disabled={locating}
            className="rounded-lg border border-emerald-400/35 bg-emerald-400/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-200 transition hover:bg-emerald-400/20 disabled:opacity-50"
            title={lang === "zh" ? "用 GPS 定位到我当前所在位置，看看我脚下此刻" : "Use GPS to see where I am, right now"}
          >
            ⌖ {locating ? t("explore.locating") : t("explore.locateMe")}
          </button>
        </div>
        {timelineOpen && (
          <div className="mx-3 mt-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            {saved.length === 0 ? (
              <p className="text-[11px] leading-relaxed text-slate-400">{t("explore.timelineEmpty")}</p>
            ) : (
              <ul className="space-y-2">
                {[...saved].sort((a, b) => a.year - b.year).map((s) => (
                  <li key={s.id} className="flex items-start gap-2 text-[11px]">
                    <span className="shrink-0 font-semibold text-sky-300">{s.year}</span>
                    <span className="min-w-0 flex-1 text-slate-300">
                      <span className="block truncate">{s.title}</span>
                      <span className="text-slate-500">{s.place} · {s.month}/{s.day}</span>
                    </span>
                    {s.sourceUrl && (
                      <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer"
                         className="shrink-0 text-sky-400 hover:text-sky-300" title={t("explore.sourceLink")}>↗</a>
                    )}
                    <button onClick={() => removeSaved(s.id)} className="shrink-0 text-slate-500 hover:text-rose-300"
                            title={t("explore.timelineRemove")}>×</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

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
            {/* 全站统一入口：任意事件 → 同一套真实照片幻灯片 */}
            {reelTarget && (
              <a
                href={reelHrefFor(reelTarget)}
                data-track="reel_start"
                data-track-label="explore-cta"
                className="rounded-lg border border-amber-400/50 bg-amber-400/15 px-3 py-1.5 text-xs font-semibold text-amber-200 transition hover:bg-amber-400/25"
                title={lang === "zh"
                  ? "播放该事件的自由授权史料照片幻灯片：真实照片自动轮换，逐张标注来源与许可"
                  : "Play the archival photo slideshow: freely licensed photos rotating, with per-image credits"}
              >
                ▤ {lang === "zh" ? "看史料幻灯片" : "View slideshow"}
              </a>
            )}
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
              ? `对话已注入场景：${fmtDate(today.m, today.d, true)} · ${visibleEvents.length} 条事件 · ${view} · 12 个白名单工具 · $5 会话硬顶`
              : `Scene grounded: ${fmtDate(today.m, today.d, false)} · ${visibleEvents.length} events · ${view} · 12 whitelisted tools · $5 session cap`}
          </div>
        </div>

        {/* Event list */}
        <div className="px-3 py-2 space-y-1">
          {loading && <div className="text-xs text-slate-400 px-2 py-4">{t("explore.loading")}</div>}
          {!loading && visibleEvents.length === 0 && (
            <div className="text-xs text-slate-400 px-2 py-6 leading-relaxed">
              {t("explore.empty")}
            </div>
          )}
          {visibleEvents.map((e) => (
            <div
              key={e.id}
              className={`relative rounded-xl border transition ${
                detail?.id === e.id ? "bg-white/5 border-sky-400/40" : "border-transparent hover:bg-white/5"
              }`}
            >
              <button
                onClick={() => setDetail(e)}
                className="w-full text-left rounded-xl px-3 py-2.5 pr-10"
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
              {/* 每个事件都能播放统一的历史照片幻灯片 */}
              <a
                href={reelHrefFor(e)}
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-amber-400/35 bg-amber-400/10 text-[11px] text-amber-200 transition hover:bg-amber-400/25"
                title={lang === "zh" ? "查看这个事件的史料照片幻灯片" : "View the archival photo slideshow for this event"}
              >
                ▤
              </a>
            </div>
          ))}
        </div>

        {/* Detail */}
        {detail && (
          <div className="mx-3 mb-3 rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: categoryColor(detail.category) }} />
              <span className="text-[11px] uppercase tracking-wider text-slate-400">{t(`category.${detail.category}`)}</span>
              <span className="text-[10px] text-slate-500 border border-white/10 rounded px-1.5 py-0.5">
                {sourceLabel(detail.source)}
              </span>
              <button
                onClick={() => toggleSave(detail)}
                className="ml-auto rounded-lg border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-[10px] text-amber-200 transition hover:bg-amber-400/20"
                title={lang === "zh" ? "收藏到我的时间线" : "Save to my timeline"}
              >
                {saved.some((s) => s.id === detail.id) ? t("explore.savedPlace") : t("explore.savePlace")}
              </button>
            </div>
            <h3 className="editorial text-lg text-white leading-snug">{detail.title}</h3>
            <div className="text-xs text-sky-300 font-semibold mt-1">{fmtYear(detail.year, zh)} · {detail.place || t("explore.locationNotPinned")}</div>
            <p className="text-sm text-slate-300 leading-relaxed mt-2">{detail.description}</p>
            {/* 研究者/教师刚需：每个事件都能一键跳到可核查的原始出处 */}
            {detail.sourceUrl && (
              <a
                href={detail.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-sky-400/30 bg-sky-400/10 px-3 py-1.5 text-[11px] font-semibold text-sky-200 transition hover:bg-sky-400/20"
              >
                {t("explore.sourceLink")}
              </a>
            )}
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
        {/* 旅行者：原按钮看的是「事件地点此刻」，这里补上「我脚下此刻」 */}
        <div className="mx-3 mb-4 -mt-2 flex items-center gap-2">
          <button
            onClick={locateMe}
            disabled={locating}
            className="rounded-lg border border-emerald-400/30 px-2.5 py-1 text-[10px] text-emerald-200 transition hover:bg-emerald-400/10 disabled:opacity-50"
          >
            ⌖ {locating ? t("explore.locating") : t("explore.locateMe")}
          </button>
          <span className="text-[10px] text-slate-500">
            {lang === "zh" ? "用 GPS 看我当前所在位置此刻的样子" : "Use GPS to see where I am right now"}
          </span>
        </div>

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
          {askError && (
            <div className="mt-3 rounded-lg bg-amber-400/10 border border-amber-400/30 p-3">
              <p className="text-xs leading-relaxed text-amber-200">{askError}</p>
            </div>
          )}
          {answer && (
            <div className="mt-3 rounded-lg bg-amber-400/5 border border-amber-400/20 p-3">
              <div className="text-[10px] uppercase tracking-wider text-amber-300/70 mb-1">Historia</div>
              <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">{answer}</p>
              {/* 逐条出处引用：回答里的 [n] 可一键跳到原始资料 */}
              {askSources.length > 0 && (
                <div className="mt-3 border-t border-amber-400/20 pt-2">
                  <div className="text-[10px] uppercase tracking-wider text-amber-300/70 mb-1.5">
                    {zh ? "资料来源" : "Sources"}
                  </div>
                  <ol className="space-y-1">
                    {askSources.map((s) => (
                      <li key={s.n} className="text-[11px] leading-relaxed text-slate-300">
                        <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-sky-300 hover:underline">
                          [{s.n}] {s.title}{s.year ? ` (${s.year})` : ""}
                        </a>
                        {s.place && <span className="text-slate-500"> · {s.place}</span>}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
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
