import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlaceContent, allPlaceSlugs, dateLabel, everyDateSlug } from "@/lib/content";
import { getSEOTags } from "@/lib/seo";
import {
  Breadcrumbs, AnswerBox, PriceNote, SourceNote, Cta, SiteFooterLinks, JsonLd,
} from "@/components/content/ContentFrame";

export const dynamicParams = true;
export const revalidate = 86400;

// 只预生成少量地点页，其余按需 SSR。
export function generateStaticParams() {
  return allPlaceSlugs().slice(0, 6).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const p = getPlaceContent(params.slug);
  if (!p) return getSEOTags({ title: "Historical places · Historia Globe" });
  return getSEOTags({
    title: `History of ${p.place} · Historia Globe`,
    description: `${p.events.length} verified historical events recorded at ${p.place}, with dates, coordinates and source links. Explore them free on an interactive 3D globe.`,
    canonicalUrlRelative: `/place/${params.slug}`,
  });
}

export default function PlacePage({ params }: { params: { slug: string } }) {
  const p = getPlaceContent(params.slug);
  if (!p) notFound();
  const coords = p.events[0];

  const answer = `${p.place} appears in ${p.events.length} verified historical record${p.events.length === 1 ? "" : "s"} in our curated archive, ranging from ${p.events[p.events.length - 1].year < 0 ? `${-p.events[p.events.length - 1].year} BCE` : p.events[p.events.length - 1].year} to ${p.events[0].year}. Each has a date, coordinates and a clickable Wikipedia source link. All free.`;
  const zhAnswer = `${p.place} 在本地已核验策展库中收录 ${p.events.length} 条历史事件，均含日期、坐标与维基百科溯源链接，全部免费。`;

  return (
    <main className="mx-auto max-w-3xl px-5 pb-24 pt-12 sm:px-8">
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "Place",
        name: p.place,
        geo: { "@type": "GeoCoordinates", latitude: coords.lat, longitude: coords.lon },
        subjectOf: {
          "@type": "ItemList",
          numberOfItems: p.events.length,
          itemListElement: p.events.map((e, i) => ({
            "@type": "ListItem", position: i + 1,
            name: `${e.title} (${e.year})`,
            url: `https://historiaglobe.com/event/${e.slug}`,
          })),
        },
      }} />
      <Breadcrumbs items={[{ label: "Places", href: "/explore" }, { label: p.place }]} />
      <AnswerBox kicker="Historical place · 历史地点" title={`History of ${p.place}`} answer={answer} zhAnswer={zhAnswer} />
      <PriceNote />

      <section className="mt-10">
        <h2 className="editorial text-xl text-white">{p.events.length} events at this place</h2>
        <ul className="mt-4 space-y-3">
          {p.events.map((e) => (
            <li key={e.slug} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="text-xs font-semibold text-sky-300">
                {dateLabel(e.m, e.d)}, {e.year < 0 ? `${-e.year} BCE` : e.year} · {e.category}
              </div>
              <h3 className="editorial mt-1 text-lg text-white">
                <Link href={`/event/${e.slug}`} className="hover:underline">{e.title}</Link>
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">{e.description}</p>
              <p className="mt-2 text-xs text-slate-500">
                <Link href={`/on-this-day/${e.dateSlug}`} className="text-sky-300 underline">On this day ↗</Link>
                {" · "}
                <a href={e.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-sky-300 underline">Wikipedia source ↗</a>
              </p>
            </li>
          ))}
        </ul>
        <SourceNote count={p.events.length} />
      </section>

      <section className="mt-8">
        <h2 className="editorial text-lg text-white">Browse all dates</h2>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          {everyDateSlug().length} date pages are indexed in the{" "}
          <Link href="/sitemap.xml" className="text-sky-300 underline">sitemap ↗</Link>, so any day can
          be reached directly by search engines and AI assistants.
        </p>
      </section>

      <Cta />
      <SiteFooterLinks />
    </main>
  );
}
