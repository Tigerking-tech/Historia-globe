import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getDateContent,
  getSupplementalEvents,
  parseDateSlug,
  dateLabel,
  allDateSlugs,
  nearbyDates,
  photosForEvent,
  type ContentEvent,
} from "@/lib/content";
import { getSEOTags } from "@/lib/seo";
import {
  Breadcrumbs, AnswerBox, PriceNote, SourceNote, Cta, SiteFooterLinks, JsonLd,
} from "@/components/content/ContentFrame";
import { VERIFIED_PHOTOS } from "@/lib/content";

export const dynamicParams = true;
// 页面按需生成时用 ISR 缓存一天，兼顾爬虫首访与构建稳定性。
export const revalidate = 86400;

// 只预生成少量代表日期（避免 600+ 页把静态 worker 拖到 60s 超时）；
// 其余日期 dynamicParams=true 按需 SSR，输出同样是完整 HTML，sitemap 列全量。
const FEATURED_DATES = ["01-01", "02-04", "07-20", "09-11", "11-09", "12-25"];
export function generateStaticParams() {
  const available = new Set(allDateSlugs());
  return FEATURED_DATES.filter((d) => available.has(d)).map((date) => ({ date }));
}

export async function generateMetadata({
  params,
}: {
  params: { date: string };
}): Promise<Metadata> {
  const parsed = parseDateSlug(params.date);
  if (!parsed) return getSEOTags({ title: "On This Day · Historia Globe" });
  const c = getDateContent(params.date);
  const label = dateLabel(parsed.m, parsed.d);
  const events = c?.events ?? [];
  const supplemental = getSupplementalEvents(params.date);
  const total = events.length + supplemental.length;
  const hasEvents = total > 0;
  const names = [
    ...events.map((e) => `${e.title} (${e.year})`),
    ...supplemental.map((e) => `${e.title} (${e.year})`),
  ].slice(0, 3);
  return getSEOTags({
    // L2 差异化主词进 title：避开 Wikipedia / History.com 垄断的 "on this day in history"。
    title: `${label} in History Around the World · Historia Globe`,
    description: hasEvents
      ? `${label} in history around the world: ${total} historical event${total === 1 ? "" : "s"} with clickable source links — ${names.join("; ")}. What else happened that day? Free, with real archival photos where verified.`
      : `${label} in history around the world. This date currently has no curated event in our archive; browse nearby dates or explore the interactive 3D history globe to see what else happened that day. Free, with clickable sources.`,
    canonicalUrlRelative: `/on-this-day/${params.date}`,
    // 零事件日期页不进入索引，避免 220 个薄页稀释整站质量分。
    // sitemap 仍保留 366 个日期 URL（既有验收要求 sitemap >500 条），noindex 优先级更高。
    // 构建期快照补齐后 total > 0，无需改代码即自动恢复索引。
    ...(hasEvents ? {} : { extraTags: { robots: { index: false, follow: true } } }),
  });
}

function PhotoCredits({ events }: { events: ContentEvent[] }) {
  const has = events.some((e) => photosForEvent(e).length > 0);
  if (!has || !VERIFIED_PHOTOS.length) {
    return (
      <section className="mt-8 rounded-xl border border-white/10 bg-white/[0.02] px-5 py-4">
        <h2 className="text-sm font-semibold text-white">Archival photos · 史料照片</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          No verified freely licensed archival photo is attached to the events on this date yet.
          We never substitute AI-generated images or vector schematics for real historical photos.
          The 9/11 slideshow with NOAA / NIST / US Navy public-domain photos is available{" "}
          <Link href="/reel.html?q=911" className="text-sky-300 underline">here ↗</Link>.
        </p>
      </section>
    );
  }
  return (
    <section className="mt-8 rounded-xl border border-white/10 bg-white/[0.02] px-5 py-4">
      <h2 className="text-sm font-semibold text-white">Verified archival photos · 逐张署名</h2>
      <ul className="mt-3 space-y-3">
        {VERIFIED_PHOTOS.map((p) => (
          <li key={p.url} className="text-xs leading-relaxed text-slate-300">
            <a href={p.sourcePage} target="_blank" rel="noopener noreferrer" className="text-sky-300 underline">
              {p.title} — {p.author}
            </a>
            <span className="ml-2 text-slate-500">{p.licenseShort} · {p.note}</span>
            <a href={p.licenseUrl} target="_blank" rel="noopener noreferrer" className="ml-2 text-slate-400 underline">licence ↗</a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function OnThisDayPage({ params }: { params: { date: string } }) {
  const parsed = parseDateSlug(params.date);
  if (!parsed) notFound();
  const c = getDateContent(params.date);
  const label = dateLabel(parsed.m, parsed.d);
  const events = c?.events ?? [];
  const supplemental = getSupplementalEvents(params.date);
  const total = events.length + supplemental.length;
  const near = nearbyDates(params.date);

  const answer = total
    ? `On ${label}, this page records ${total} historical event${total === 1 ? "" : "s"}: ${events.length} geolocated curated event${events.length === 1 ? "" : "s"} and ${supplemental.length} from Wikipedia's On this day feed, each with a clickable source link. ${[...events, ...supplemental].slice(0, 3).map((e) => `${e.title} (${e.year < 0 ? `${-e.year} BCE` : e.year})`).join("; ")}${total > 3 ? " and more" : ""}. All free, no sign-up.`
    : `On ${label}, our curated archive currently has no geolocated events pinned. This is an honest gap, not a claim that nothing happened — see nearby dates below and explore the live globe, which merges Wikipedia and Wikidata when reachable.`;
  const zhAnswer = total
    ? `${label}：本页收录 ${total} 条历史事件——${events.length} 条带坐标的策展条目，以及 ${supplemental.length} 条来自 Wikipedia On this day 的补充条目，每条都可一键溯源。`
    : `${label}：本地策展库暂未收录带坐标的事件。这是如实的空缺，不代表那天什么都没发生；可查看下方邻近日期或前往实时地球。`;

  return (
    <main className="mx-auto max-w-3xl px-5 pb-24 pt-12 sm:px-8">
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: `On This Day: ${label} in history`,
        numberOfItems: total,
        itemListElement: [
          ...events.map((e) => ({
            "@type": "ListItem",
            name: `${e.title} (${e.year})`,
            url: `https://historiaglobe.com/event/${e.slug}`,
          })),
          // 补充条目没有站内事件页，直接指向真实 Wikipedia 出处，绝不造死链。
          ...supplemental.map((e) => ({
            "@type": "ListItem",
            name: `${e.title} (${e.year})`,
            url: e.sourceUrl,
          })),
        ].map((item, i) => ({ ...item, position: i + 1 })),
      }} />
      <Breadcrumbs items={[{ label: "On This Day", href: "/explore" }, { label }]} />
      <AnswerBox kicker={`On This Day · ${params.date}`} title={`${label} in history`} answer={answer} zhAnswer={zhAnswer} />
      <PriceNote />

      {events.length > 0 && (
        <section className="mt-10">
          <h2 className="editorial text-xl text-white">{events.length} recorded event{events.length === 1 ? "" : "s"}</h2>
          <ul className="mt-4 space-y-4">
            {events.map((e) => (
              <li key={e.slug} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="text-xs font-semibold text-sky-300">
                  {e.year < 0 ? `${-e.year} BCE` : e.year} · {e.category}
                </div>
                <h3 className="editorial mt-1 text-lg text-white">
                  <Link href={`/event/${e.slug}`} className="hover:underline">{e.title}</Link>
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{e.description}</p>
                <p className="mt-2 text-xs text-slate-500">
                  {e.place} · {e.lat.toFixed(2)}°, {e.lon.toFixed(2)}° ·{" "}
                  <a href={e.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-sky-300 underline">Wikipedia source ↗</a>
                  {" · "}
                  <Link href={`/event/${e.slug}`} className="text-sky-300 underline">full record ↗</Link>
                </p>
              </li>
            ))}
          </ul>
          <SourceNote count={events.length} />
          <PhotoCredits events={events} />
        </section>
      )}

      {/* 构建期补入的静态条目：只读、可禁用 JS 直接读到全文，无坐标、无站内死链。 */}
      {supplemental.length > 0 && (
        <section className="mt-10">
          <h2 className="editorial text-xl text-white">
            More on this date · {supplemental.length} from Wikipedia&apos;s On this day
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            These entries come from Wikimedia&apos;s public On this day feed and are stored as static text at build time.
            They have no verified coordinates, so they appear here as dated source links only — not as pins on the globe.
          </p>
          <ul className="mt-4 space-y-4">
            {supplemental.map((e, i) => (
              <li key={`${e.year}-${e.title}-${i}`} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="text-xs font-semibold text-sky-300">
                  {e.year < 0 ? `${-e.year} BCE` : e.year} · Wikipedia
                </div>
                <h3 className="editorial mt-1 text-lg text-white">
                  <a href={e.sourceUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">{e.title}</a>
                </h3>
                {e.description && <p className="mt-2 text-sm leading-relaxed text-slate-300">{e.description}</p>}
                <p className="mt-2 text-xs text-slate-500">
                  <a href={e.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-sky-300 underline">Wikipedia source ↗</a>
                </p>
              </li>
            ))}
          </ul>
          {events.length === 0 && <SourceNote count={supplemental.length} />}
        </section>
      )}

      {total === 0 && (
        <section className="mt-10">
          <h2 className="editorial text-xl text-white">Nearby dates with records</h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {near.map((n) => (
              <li key={n.slug}>
                <Link href={`/on-this-day/${n.slug}`} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 hover:text-white">
                  {n.label} · {n.events.length} event{n.events.length === 1 ? "" : "s"}
                </Link>
              </li>
            ))}
          </ul>
          <SourceNote count={0} />
        </section>
      )}

      <Cta />
      <SiteFooterLinks />
    </main>
  );
}
