import type { Metadata } from "next";
import Link from "next/link";
import { getSEOTags } from "@/lib/seo";
import {
  Breadcrumbs, AnswerBox, PriceNote, Cta, SiteFooterLinks, JsonLd,
} from "@/components/content/ContentFrame";
import {
  BOUNDARY_SOURCES,
  BOUNDARY_DATASET,
  BOUNDARY_LAYERS,
  BOUNDARY_STATUS,
  BOUNDARY_NOTES,
  MODERN_LAYER,
  PANEL_YEARS_IN_SOURCE,
  boundaryStats,
  sliderYears,
} from "@/lib/historical-boundaries";

export const revalidate = 86400;

const stats = boundaryStats();
const years = sliderYears();

export const metadata: Metadata = getSEOTags({
  title: "Historical borders by year · open data & sources · Historia Globe",
  description:
    "Explore historical country and polity boundaries by year on a 3D globe. 14 real year layers from CC BY 4.0 Cliopatria data, each with per-polity Wikipedia source links, exact licence and citation metadata, and explicit accuracy limits. No invented borders, no interpolation.",
  keywords: [
    "historical borders by year",
    "historical country boundaries map",
    "open historical boundary data CC BY",
    "time slider historical atlas",
    "polity boundaries 3400 BCE",
  ],
  canonicalUrlRelative: "/historical-boundaries",
});

function fmtYear(y: number) {
  return y < 0 ? `${-y} BCE` : `CE ${y}`;
}

export default function HistoricalBoundariesPage() {
  const faq = [
    {
      q: "Which dataset provides the historical border layers?",
      a: `Aligned Cliopatria v1.1 (UC Merced GIS Center), licensed CC BY 4.0, derived from Cliopatria v0.0.1 (Zenodo DOI 10.5281/zenodo.13363121) and cited as Bennett et al. (2025), Scientific Data 12, 247. The source exposes ${PANEL_YEARS_IN_SOURCE} panel years from 3400 BCE; this site bundles ${stats.layers} representative real years. The present-day baseline is Natural Earth (public domain).`,
    },
    {
      q: "Does every border have a source I can check?",
      a: `Yes. Each layer publishes dataset-level provenance (name, licence, source URL, academic citation and accuracy statement), and ${stats.withWikipedia} of ${stats.totalPolities} bundled polity features (${stats.wikiCoverage}%) carry their own Wikipedia link. These are secondary encyclopedic entries, not primary historical sources, and the boundaries are scholarly approximations of polity extent rather than precise legal borders.`,
    },
    {
      q: "Why does historical coverage stop at 1497?",
      a: "1497 is the last reviewed year in Aligned Cliopatria v1.1. The source states that 3400 BCE-1000 CE is reviewed and corrected, while 1000-2024 CE will be appended after review. No boundary is invented or interpolated for years without data; the slider snaps to the nearest real panel year and labels it. The most popular alternative dataset (GPL-3.0) is excluded for licence reasons, explained on the checkable fact page.",
    },
  ];

  return (
    <main className="mx-auto max-w-3xl px-5 pb-24 pt-12 sm:px-8">
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faq.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      }} />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "Dataset",
        name: "Aligned Cliopatria v1.1 historical polity boundaries (subset bundled by Historia Globe)",
        license: "https://creativecommons.org/licenses/by/4.0/",
        citation: BOUNDARY_DATASET.citation,
        url: BOUNDARY_DATASET.repository,
        temporalCoverage: `${fmtYear(stats.firstYear ?? -3400)}/${fmtYear(stats.lastYear ?? 1497)}`,
        isAccessibleForFree: true,
      }} />
      <Breadcrumbs items={[
        { label: "Home", href: "/" },
        { label: "Facts", href: "/facts" },
        { label: "Historical borders" },
      ]} />

      <AnswerBox
        kicker="Historical borders · 历史国界"
        title="Borders you can check, years that really exist"
        answer={`Historia Globe's time slider overlays historical polity boundaries on a 3D globe using openly licensed data: ${stats.layers} real year layers from Aligned Cliopatria v1.1 (CC BY 4.0), ${stats.totalPolities} polity features, ${stats.wikiCoverage}% with per-polity Wikipedia source links. Every layer states its licence, citation and accuracy limit. Years without data are never interpolated, and coverage ends at ${fmtYear(stats.lastYear ?? 1497)} — the last reviewed year in the source — rather than pretending to cover the present.`}
        zhAnswer={`Historia Globe 的时间滑块把历史政权边界叠加到 3D 地球，数据来自明确许可的开放数据集：Aligned Cliopatria v1.1（CC BY 4.0）的 ${stats.layers} 个真实年份图层、${stats.totalPolities} 个政体要素，其中 ${stats.wikiCoverage}% 带逐要素维基出处链接。每个图层都标注许可、学术引用与精度边界。无数据的年份一律不插值；历史覆盖止于 ${fmtYear(stats.lastYear ?? 1497)}（源数据最后一个已审阅年份），不谎称覆盖到现代。`}
      />
      <PriceNote />

      {/* 结论句（第一屏，服务端直出，禁 JS 可读） */}
      <p className="mt-6 rounded-xl border border-sky-400/25 bg-sky-400/[0.05] px-4 py-3 text-sm leading-relaxed text-slate-200">
        In short: this is <strong>not a complete historical atlas</strong>. It is a set of {stats.layers} real,
        individually checkable year snapshots from an openly licensed scholarly dataset, plus an honest statement
        of what is missing. The interactive time slider lives on the{" "}
        <Link href="/explore" className="text-sky-300 underline">Explore globe ↗</Link>.
      </p>
      <p lang="zh-CN" className="mt-2 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm leading-relaxed text-slate-300">
        简言之：这不是一套完整的历史地图集，而是 {stats.layers} 个来自开放许可学术数据集、可逐层核对的真实年份快照，外加对缺失部分的如实说明。交互式时间滑块在「探索地球」页，边界为学术近似的政权范围，不是精确法律国界。
      </p>

      <section className="mt-10">
        <h2 className="editorial text-xl text-white">The {stats.layers} real year layers</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          Only years that exist in the source dataset are offered. Between these panels the slider snaps to the
          nearest real year — it never draws a boundary for a year with no data. Each GeoJSON file is served
          statically and includes its own provenance block.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-white/15 text-slate-400">
                <th className="py-2 pr-3 font-medium">Year</th>
                <th className="py-2 pr-3 font-medium">Polities</th>
                <th className="py-2 pr-3 font-medium">With Wikipedia link</th>
                <th className="py-2 pr-3 font-medium">Size</th>
                <th className="py-2 font-medium">Layer</th>
              </tr>
            </thead>
            <tbody>
              {BOUNDARY_LAYERS.map((l) => (
                <tr key={l.year} className="border-b border-white/5">
                  <td className="py-2 pr-3 text-sky-300 font-semibold">{fmtYear(l.year)}</td>
                  <td className="py-2 pr-3 text-slate-300">{l.polityCount.toLocaleString("en-US")}</td>
                  <td className="py-2 pr-3 text-slate-300">{l.withWikipedia.toLocaleString("en-US")}</td>
                  <td className="py-2 pr-3 text-slate-500">{(l.bytes / 1024).toFixed(0)} KB</td>
                  <td className="py-2">
                    <a href={l.file} className="text-sky-300 underline" target="_blank" rel="noopener noreferrer">GeoJSON ↗</a>
                  </td>
                </tr>
              ))}
              <tr className="border-b border-white/5">
                <td className="py-2 pr-3 text-emerald-300 font-semibold">{fmtYear(Number(MODERN_LAYER.year))}</td>
                <td className="py-2 pr-3 text-slate-300" colSpan={3}>Present-day baseline (Natural Earth, public domain) — not a historical reconstruction</td>
                <td className="py-2">
                  <a href={String(MODERN_LAYER.file)} className="text-sky-300 underline" target="_blank" rel="noopener noreferrer">GeoJSON ↗</a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Snapshot status: <span className={BOUNDARY_STATUS === "ok" ? "text-emerald-300" : "text-amber-300"}>{BOUNDARY_STATUS}</span> ·
          {" "}slider positions: {years.length} ({years.map(fmtYear).join(", ")}).
        </p>
      </section>

      <section className="mt-10">
        <h2 className="editorial text-xl text-white">Where the data comes from</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          {BOUNDARY_DATASET.name} · <strong className="text-slate-200">{BOUNDARY_DATASET.licence}</strong>.
          {" "}{BOUNDARY_DATASET.citation}
        </p>
        <ul className="mt-3 space-y-1.5 text-sm text-slate-300">
          <li>
            Source feature service:{" "}
            <a href={BOUNDARY_DATASET.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-sky-300 underline">ArcGIS FeatureServer ↗</a>
          </li>
          <li>
            Repository &amp; licence:{" "}
            <a href={BOUNDARY_DATASET.repository} target="_blank" rel="noopener noreferrer" className="text-sky-300 underline">ucmerced-giscenter/cliopatria ↗</a>
            {" · "}
            <a href={BOUNDARY_DATASET.licenceUrl} target="_blank" rel="noopener noreferrer" className="text-sky-300 underline">CC BY 4.0 ↗</a>
            {" · "}
            <a href={BOUNDARY_DATASET.doi} target="_blank" rel="noopener noreferrer" className="text-sky-300 underline">Zenodo DOI ↗</a>
          </li>
          <li className="text-slate-400">
            Modifications: {BOUNDARY_DATASET.modifications}
          </li>
          <li className="text-amber-200/80">
            Accuracy: {BOUNDARY_DATASET.accuracyNote}
          </li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="editorial text-xl text-white">Open datasets evaluated (2026-11-08)</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          We checked GitHub for existing wheels before building this. The most popular historical-boundary
          dataset is deliberately excluded — see the{" "}
          <Link href="/facts/historical-boundaries-and-licences" className="text-sky-300 underline">checkable fact page ↗</Link>{" "}
          for the full licence reasoning.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-white/15 text-slate-400">
                <th className="py-2 pr-3 font-medium">Project / licence</th>
                <th className="py-2 pr-3 font-medium">Decision</th>
                <th className="py-2 font-medium">Coverage</th>
              </tr>
            </thead>
            <tbody>
              {BOUNDARY_SOURCES.map((s) => (
                <tr key={s.id} className="border-b border-white/5 align-top">
                  <td className="py-2 pr-3">
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-slate-200 underline decoration-slate-600 hover:decoration-sky-300">{s.name}</a>
                    <br /><span className="text-xs text-slate-500">{s.licence}</span>
                  </td>
                  <td className="py-2 pr-3">
                    <span className={s.kind === "bundled" ? "text-emerald-300" : "text-amber-300/90"}>
                      {s.kind === "bundled" ? "Bundled" : s.kind === "competitor" ? "Competitor" : "Not bundled"}
                    </span>
                    <br /><span className="text-xs leading-relaxed text-slate-500">{s.reason}</span>
                  </td>
                  <td className="py-2 text-xs text-slate-400">{s.coverage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="editorial text-xl text-white">Limits &amp; honest notes</h2>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-300">
          {BOUNDARY_NOTES.map((n, i) => <li key={i}>· {n}</li>)}
          <li>· Boundaries and Wikipedia links are secondary scholarly material — not primary historical sources and not precise legal borders.</li>
          <li>· For structured access, use the free public read-only API and MCP endpoint; every layer is machine-readable with its provenance.</li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="editorial text-xl text-white">FAQ</h2>
        <div className="mt-3 space-y-4">
          {faq.map((f) => (
            <div key={f.q} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <h3 className="font-semibold text-white">{f.q}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <Cta />
      <SiteFooterLinks />
    </main>
  );
}
