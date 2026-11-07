import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getEventContent, allEventSlugs, dateLabel, photosForEvent,
  getPlaceContent, type ContentEvent,
} from "@/lib/content";
import { getSEOTags } from "@/lib/seo";
import {
  Breadcrumbs, AnswerBox, PriceNote, Cta, SiteFooterLinks, JsonLd,
} from "@/components/content/ContentFrame";

export const dynamicParams = true;
export const revalidate = 86400;

// 只预生成少量代表事件页，其余按需 SSR（完整 HTML，爬虫一样可读）。
// 全量预生成 150+ 事件页会让静态 worker 超时。
export function generateStaticParams() {
  return allEventSlugs().slice(0, 8).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const e = getEventContent(params.slug);
  if (!e) return getSEOTags({ title: "Historical event · Historia Globe" });
  const year = e.year < 0 ? `${-e.year} BCE` : String(e.year);
  return getSEOTags({
    title: `${e.title} (${year}) · Historia Globe`,
    // L2 内链闭环词：从单条事件回到「这一天世界别处还发生了什么」，
    // 避开 Wikipedia / NASA 垄断的 "on this day in history" 正面竞争。
    description: `${e.description} Location: ${e.place}, ${year}. What else happened that day around the world? See ${dateLabel(e.m, e.d)} on our interactive 3D history globe — free, with clickable Wikipedia sources and per-image archival photo credits.`,
    keywords: [
      "what else happened that day",
      `${dateLabel(e.m, e.d)} in history around the world`,
      e.category ? `${e.category} history timeline` : "history timeline",
      "free history globe with citations",
    ],
    canonicalUrlRelative: `/event/${params.slug}`,
  });
}

function PhotoSection({ e }: { e: ContentEvent }) {
  const photos = photosForEvent(e);
  if (!photos.length) {
    return (
      <section className="mt-8 rounded-xl border border-white/10 bg-white/[0.02] px-5 py-4">
        <h2 className="text-sm font-semibold text-white">Archival photos · 史料照片</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          No verified freely licensed archival photo is attached to this event yet. We do not
          substitute generated or schematic imagery. See the{" "}
          <Link href="/reel.html?q=911" className="text-sky-300 underline">9/11 public-domain slideshow ↗</Link>{" "}
          for an example of our per-image credit standard.
        </p>
      </section>
    );
  }
  return (
    <section className="mt-8">
      <h2 className="editorial text-xl text-white">Verified archival photos · 逐张署名</h2>
      <ul className="mt-4 space-y-4">
        {photos.map((p) => (
          <li key={p.url} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            {/* 真实照片，直接 <img>，可被爬虫读到 alt 与 src */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={`${p.title} — ${p.author}, ${p.licenseShort}`} loading="lazy" className="w-full rounded-lg" />
            <p className="mt-3 text-sm text-white">{p.title} · {p.note}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              {p.author} · {p.licenseShort} ·{" "}
              <a href={p.sourcePage} target="_blank" rel="noopener noreferrer" className="text-sky-300 underline">Commons source ↗</a>{" "}
              <a href={p.licenseUrl} target="_blank" rel="noopener noreferrer" className="text-sky-300 underline">licence ↗</a>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function EventPage({ params }: { params: { slug: string } }) {
  const e = getEventContent(params.slug);
  if (!e) notFound();
  const year = e.year < 0 ? `${-e.year} BCE` : String(e.year);
  const label = dateLabel(e.m, e.d);
  const place = getPlaceContent(e.placeSlug);

  const answer = `${e.title} took place in ${year} at ${e.place}. ${e.description} This record is free to explore, includes coordinates (${e.lat.toFixed(2)}°, ${e.lon.toFixed(2)}°) and links to its Wikipedia source.`;
  const zhAnswer = `${e.title} 发生于 ${year}，地点 ${e.place}。${e.description} 本记录免费查看，含坐标与维基百科溯源链接。`;

  return (
    <main className="mx-auto max-w-3xl px-5 pb-24 pt-12 sm:px-8">
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "Article",
        headline: `${e.title} (${year})`,
        description: e.description,
        datePublished: `${Math.max(1, e.year)}-${String(e.m).padStart(2, "0")}-${String(e.d).padStart(2, "0")}`,
        author: { "@type": "Organization", name: "Historia Globe" },
        about: { "@type": "Place", name: e.place, geo: { "@type": "GeoCoordinates", latitude: e.lat, longitude: e.lon } },
        citation: e.sourceUrl,
      }} />
      <Breadcrumbs items={[
        { label: "On This Day", href: "/explore" },
        { label, href: `/on-this-day/${e.dateSlug}` },
        { label: e.title },
      ]} />
      <AnswerBox kicker={`Historical event · ${year} · ${e.category}`} title={e.title} answer={answer} zhAnswer={zhAnswer} />
      <PriceNote />

      <section className="mt-8 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <div className="text-[11px] uppercase tracking-widest text-slate-500">Date</div>
          <Link href={`/on-this-day/${e.dateSlug}`} className="mt-1 block text-sm text-sky-300 underline">{label}, {year}</Link>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <div className="text-[11px] uppercase tracking-widest text-slate-500">Place · 地点</div>
          {place ? (
            <Link href={`/place/${place.slug}`} className="mt-1 block text-sm text-sky-300 underline">{e.place}</Link>
          ) : (
            <span className="mt-1 block text-sm text-slate-300">{e.place}</span>
          )}
          <div className="mt-1 text-xs text-slate-500">{e.lat.toFixed(2)}°, {e.lon.toFixed(2)}°</div>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="editorial text-xl text-white">What happened</h2>
        <p className="mt-3 text-sm leading-[1.9] text-slate-300">{e.description}</p>
        <p className="mt-4 text-xs leading-relaxed text-slate-500">
          Source: this record is part of our verified curated archive. Follow the link below to the
          corresponding Wikipedia search page for primary references; we do not claim it is a primary
          source. External Wikipedia / Wikidata records are merged automatically in production when
          reachable.
        </p>
        <a href={e.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm text-sky-300 underline">
          View Wikipedia source ↗
        </a>
      </section>

      <PhotoSection e={e} />

      {/* 内链闭环：单条事件 → 同一天的全球横向视图（L2 主打词落位） */}
      <section className="mt-8 rounded-xl border border-sky-400/20 bg-sky-400/[0.04] px-5 py-4">
        <h2 className="editorial text-lg text-white">What else happened that day around the world?</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          {e.title} is one moment on {label}. Our same-day view places the events of that single
          calendar date side by side across continents, instead of following one nation&apos;s
          timeline in isolation. Each entry carries a clickable source link and the page states
          exactly how many events it records.
        </p>
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link href={`/on-this-day/${e.dateSlug}`} className="text-sky-300 underline">
            See all events on {label} ↗
          </Link>
          <Link href="/facts/same-day-vs-national-timelines" className="text-sky-300 underline">
            Why a same-day global view differs from national timelines ↗
          </Link>
        </p>
      </section>

      <Cta />
      <SiteFooterLinks />
    </main>
  );
}
