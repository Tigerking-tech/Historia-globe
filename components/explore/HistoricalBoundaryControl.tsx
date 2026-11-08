"use client";

// 历史国界时间轴控件。
//
// 设计原则（与项目「每条都能核对出处」一致）：
//  - 只对齐到真实存在的面板年，绝不插值、绝不编造边界；
//  - 每一档都显示数据集级出处（名称 / 许可 / 学术引用 / 原始 URL）；
//  - 明确说明 1497 之后无历史数据、1000 CE 之后仍在审阅、这些是学术近似而非精确法律国界。

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BOUNDARY_SOURCES,
  BOUNDARY_DATASET,
  BOUNDARY_LAYERS,
  boundaryStats,
  sliderYears,
  nearestBoundaryYear,
} from "@/lib/historical-boundaries";

function fmtYear(y: number, zh: boolean) {
  if (y < 0) return zh ? `公元前 ${-y} 年` : `${-y} BCE`;
  return zh ? `公元 ${y} 年` : `CE ${y}`;
}

type Props = {
  lang: "en" | "zh";
  enabled: boolean;
  year: number;
  onToggle: (on: boolean) => void;
  onChangeYear: (y: number) => void;
};

export default function HistoricalBoundaryControl({ lang, enabled, year, onToggle, onChangeYear }: Props) {
  const zh = lang === "zh";
  const [showSources, setShowSources] = useState(false);
  const years = useMemo(() => sliderYears(), []);
  const stats = useMemo(() => boundaryStats(), []);
  const snapped = useMemo(() => nearestBoundaryYear(year), [year]);
  const idx = Math.max(0, years.indexOf(snapped.year));
  const current = snapped.layer;
  const isModern = snapped.year === stats.modernYear;
  const bundled = BOUNDARY_SOURCES.filter((s) => s.kind === "bundled");

  return (
    <section className="mx-3 mt-3 rounded-lg border border-sky-400/20 bg-sky-400/[0.04] px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold text-sky-200">
            {zh ? "历史国界时间轴" : "Historical borders · time slider"}
          </div>
          <div className="mt-0.5 text-[10px] leading-snug text-slate-500">
            {zh
              ? `${stats.layers} 个真实年份图层 · ${stats.totalPolities} 个政体 · ${stats.wikiCoverage}% 带出处链接`
              : `${stats.layers} real year layers · ${stats.totalPolities} polities · ${stats.wikiCoverage}% with source links`}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onToggle(!enabled)}
          aria-pressed={enabled}
          className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] transition ${
            enabled
              ? "border-sky-400/60 bg-sky-500/20 text-sky-200"
              : "border-white/10 text-slate-400 hover:text-white"
          }`}
        >
          {enabled ? (zh ? "开" : "On") : zh ? "关" : "Off"}
        </button>
      </div>

      {enabled && (
        <div className="mt-3">
          <div className="flex items-baseline justify-between">
            <span className="editorial text-lg text-white">{fmtYear(snapped.year, zh)}</span>
            <span className="text-[10px] text-slate-500">
              {isModern
                ? zh ? "现代基线（非历史重建）" : "Present-day baseline (not a reconstruction)"
                : current
                  ? `${current.polityCount} ${zh ? "政体" : "polities"} · ${current.withWikipedia} ${zh ? "带维基出处" : "with Wikipedia links"}`
                  : ""}
            </span>
          </div>

          <input
            type="range"
            min={0}
            max={Math.max(0, years.length - 1)}
            step={1}
            value={idx}
            onChange={(e) => onChangeYear(years[Number(e.target.value)])}
            aria-label={zh ? "选择历史年份" : "Select historical year"}
            className="mt-2 w-full accent-sky-400"
          />
          <div className="mt-0.5 flex justify-between text-[9px] text-slate-600">
            <span>{fmtYear(years[0] ?? -3400, zh)}</span>
            <span>{fmtYear(years[years.length - 1] ?? 2026, zh)}</span>
          </div>
          <p className="mt-1.5 text-[10px] leading-snug text-slate-500">
            {zh
              ? "边界仅在「国界」视图绘制；打开本开关会自动切换。若手动切回卫星/夜景视图，边界将隐藏。"
              : "Borders render only in the Countries view; enabling this slider switches to it automatically. Switching back to Satellite/Night hides them."}
          </p>

          {!snapped.exact && (
            <p className="mt-1.5 text-[10px] text-amber-300/80">
              {zh
                ? `已对齐到最近的真实面板年 ${fmtYear(snapped.year, zh)}；无数据的年份不插值。`
                : `Snapped to nearest real panel year ${fmtYear(snapped.year, false)}; years without data are not interpolated.`}
            </p>
          )}

          {/* 出处卡片：把「可核对」做成 UI 一等公民 */}
          <div className="mt-2.5 rounded-md border border-white/10 bg-black/20 px-2.5 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold text-slate-300">
                {zh ? "数据来源与许可" : "Dataset provenance & licence"}
              </span>
              <button
                type="button"
                onClick={() => setShowSources((v) => !v)}
                className="text-[10px] text-sky-300 underline"
              >
                {showSources ? (zh ? "收起" : "Hide") : zh ? "展开全部" : "Show all"}
              </button>
            </div>
            {!isModern && (
              <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
                <span className="text-slate-200">{BOUNDARY_DATASET.name}</span> · {BOUNDARY_DATASET.licence}
                <br />
                <a href={BOUNDARY_DATASET.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-sky-300 underline">
                  {zh ? "原始要素服务 ↗" : "Source feature service ↗"}
                </a>
                {" · "}
                <a href={BOUNDARY_DATASET.repository} target="_blank" rel="noopener noreferrer" className="text-sky-300 underline">
                  {zh ? "数据仓库 ↗" : "Repository ↗"}
                </a>
                {" · "}
                <a href={BOUNDARY_DATASET.doi} target="_blank" rel="noopener noreferrer" className="text-sky-300 underline">
                  {zh ? "学术出处 ↗" : "DOI ↗"}
                </a>
              </p>
            )}
            {isModern && (
              <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
                Natural Earth 1:110m Admin-0 Countries · Public domain ·{" "}
                {zh ? "仅作现代基线与事件点位底图" : "present-day baseline only"}
              </p>
            )}
            <p className="mt-1.5 text-[10px] leading-relaxed text-amber-200/70">
              {zh
                ? "边界为学术近似的政权范围，不是精确法律国界；维基链接是二手条目、不是一手史料。1497 之后无已审阅的历史边界数据。"
                : "Boundaries are scholarly approximations of polity extent, not precise legal borders; Wikipedia links are secondary, not primary sources. No reviewed historical borders after 1497."}
            </p>

            {showSources && (
              <ul className="mt-2 space-y-1.5 border-t border-white/10 pt-2">
                {BOUNDARY_SOURCES.map((s) => (
                  <li key={s.id} className="text-[10px] leading-relaxed text-slate-400">
                    <span className="text-slate-200">{s.name}</span>{" "}
                    <span className={s.kind === "bundled" ? "text-emerald-300" : "text-amber-300/80"}>
                      [{s.kind === "bundled" ? (zh ? "内置" : "bundled") : zh ? "未内置 / 对照" : "not bundled / reference"}]
                    </span>{" "}
                    · {s.licence}
                    <br />
                    <span className="text-slate-500">{s.reason}</span>{" "}
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-sky-300 underline">↗</a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
            <Link href="/historical-boundaries" className="text-sky-300 underline">
              {zh ? "全部年份与可核对出处 ↗" : "All years & checkable sources ↗"}
            </Link>
            <Link href="/facts/historical-boundaries-and-licences" className="text-sky-300 underline">
              {zh ? "为什么不用 GPL 数据 ↗" : "Why not the GPL dataset ↗"}
            </Link>
          </div>

          {current && current.samplePolities.length > 0 && (
            <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
              {zh ? "该年示例政体：" : "Sample polities: "}
              {current.samplePolities.join(" · ")}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
