// 分享链接状态：把「某一天 + 当前视角 + 选中事件」序列化进 URL。
// 参照 GEV 的 viewToParams / viewFromParams，但只保留本项目需要的字段。
// 关键：只改动本模块自己的键，sharecode、hgdebug 等既有参数原样保留——
// 云端分享链接丢了 sharecode 会被网关拦成 403。

import type { CameraState } from "./ask-yore/types";

export type ShareState = {
  month: number;
  day: number;
  lang: "en" | "zh";
  view: "satellite" | "countries" | "night";
  realEarth: boolean;
  selectedEventId?: string | null;
  camera?: CameraState | null;
  tour?: boolean;
};

const KEYS = ["m", "d", "lang", "view", "real", "ev", "cam", "tour"] as const;

const int = (v: string | null, lo: number, hi: number) => {
  const n = Number(v);
  return v != null && Number.isFinite(n) && n >= lo && n <= hi ? Math.round(n) : null;
};

export function readShareState(search: string): Partial<ShareState> {
  const p = new URLSearchParams(search);
  const out: Partial<ShareState> = {};
  const m = int(p.get("m"), 1, 12);
  const d = int(p.get("d"), 1, 31);
  if (m != null) out.month = m;
  if (d != null) out.day = d;
  const lang = p.get("lang");
  if (lang === "en" || lang === "zh") out.lang = lang;
  const view = p.get("view");
  if (view === "satellite" || view === "countries" || view === "night") out.view = view;
  if (p.has("real")) out.realEarth = p.get("real") === "1";
  if (p.has("ev")) out.selectedEventId = (p.get("ev") || "").slice(0, 120);
  if (p.has("tour")) out.tour = p.get("tour") === "1";
  const cam = (p.get("cam") || "").split(",").map(Number);
  if (cam.length >= 3 && cam.every((n) => Number.isFinite(n))) {
    out.camera = {
      lat: Math.max(-90, Math.min(90, cam[0])),
      lon: Math.max(-180, Math.min(180, cam[1])),
      alt: Math.max(0, Math.min(60_000_000, cam[2])),
      pitch: Number.isFinite(cam[3]) ? cam[3] : -90,
      heading: Number.isFinite(cam[4]) ? cam[4] : 0,
    };
  }
  return out;
}

/** 基于当前 URL 生成新的 search 字符串（不动其他参数） */
export function writeShareState(currentSearch: string, s: ShareState): string {
  const p = new URLSearchParams(currentSearch);
  for (const k of KEYS) p.delete(k);
  p.set("m", String(s.month));
  p.set("d", String(s.day));
  p.set("lang", s.lang);
  p.set("view", s.view);
  if (s.realEarth) p.set("real", "1");
  if (s.selectedEventId) p.set("ev", s.selectedEventId);
  if (s.camera) {
    const c = s.camera;
    p.set(
      "cam",
      [
        c.lat.toFixed(3),
        c.lon.toFixed(3),
        Math.round(c.alt),
        Math.round(c.pitch ?? -90),
        Math.round(c.heading ?? 0),
      ].join(",")
    );
  }
  if (s.tour) p.set("tour", "1");
  return p.toString();
}

/** 生成可复制的绝对 URL；浏览器不可用时返回空串 */
export function buildShareUrl(s: ShareState): string {
  if (typeof window === "undefined") return "";
  const search = writeShareState(window.location.search, s);
  return `${window.location.origin}${window.location.pathname}?${search}`;
}

/** 原地更新地址栏，不触发 Next 路由跳转（避免重新渲染 / 丢 sharecode） */
export function replaceShareState(s: ShareState) {
  if (typeof window === "undefined") return;
  try {
    const search = writeShareState(window.location.search, s);
    window.history.replaceState(window.history.state, "", `${window.location.pathname}?${search}`);
  } catch {}
}
