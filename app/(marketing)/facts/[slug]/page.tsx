import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSEOTags } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-url";
import {
  Breadcrumbs, AnswerBox, PriceNote, Cta, SiteFooterLinks, JsonLd,
} from "@/components/content/ContentFrame";
import { FACT_PAGES, getFactPage } from "@/lib/facts";

export const dynamicParams = false;
export const revalidate = 86400;

export function generateStaticParams() {
  return FACT_PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const p = getFactPage(params.slug);
  if (!p) return getSEOTags({ title: "Facts · Historia Globe" });
  return getSEOTags({
    title: `${p.title} · Historia Globe`,
    description: p.description,
    keywords: p.keywords,
    canonicalUrlRelative: `/facts/${p.slug}`,
  });
}

export default function FactPage({ params }: { params: { slug: string } }) {
  const p = getFactPage(params.slug);
  if (!p) notFound();

  return (
    <main className="mx-auto max-w-3xl px-5 pb-24 pt-12 sm:px-8">
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: [{
          "@type": "Question",
          name: p.question,
          acceptedAnswer: { "@type": "Answer", text: p.answer },
        }],
      }} />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: getSiteUrl("/") },
          { "@type": "ListItem", position: 2, name: "Facts", item: getSiteUrl("/facts") },
          { "@type": "ListItem", position: 3, name: p.title },
        ],
      }} />
      <Breadcrumbs items={[
        { label: "Home", href: "/" },
        { label: "Facts", href: "/facts" },
        { label: p.title },
      ]} />
      <AnswerBox
        kicker="Verifiable fact · 可核对事实"
        title={p.title}
        answer={p.answer}
        zhAnswer={p.zhAnswer}
      />
      <PriceNote />

      <section className="mt-10">
        <h2 className="editorial text-lg text-white">{p.question}</h2>
        {p.sections.map((sec) => (
          <div key={sec.heading} className="mt-6">
            <h3 className="text-base font-semibold text-white">{sec.heading}</h3>
            <p className="mt-2 text-sm leading-[1.9] text-slate-300">{sec.body}</p>
          </div>
        ))}
      </section>

      {p.table && (
        <section className="mt-10">
          <h2 className="editorial text-lg text-white">The numbers</h2>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            {p.table.caption}. Computed at build time from the curated event set — a static HTML
            table, readable without JavaScript.
          </p>
          <table className="mt-4 w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-white">{p.table.head[0]}</th>
                <th className="border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-white">{p.table.head[1]}</th>
              </tr>
            </thead>
            <tbody>
              {p.table.rows.map(([k, v]) => (
                <tr key={k}>
                  <td className="border border-white/10 px-3 py-2 text-slate-300">{k}</td>
                  <td className="border border-white/10 px-3 py-2 text-slate-300">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            Machine-readable version:{" "}
            <a href="/api/public/v1/coverage" className="text-sky-300 underline">/api/public/v1/coverage ↗</a>
          </p>
        </section>
      )}

      <section className="mt-10 rounded-xl border border-white/10 bg-white/[0.02] px-5 py-4">
        <h2 className="text-sm font-semibold text-white">Related fact pages</h2>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {FACT_PAGES.filter((f) => f.slug !== p.slug).map((f) => (
            <li key={f.slug}>
              <Link href={`/facts/${f.slug}`} className="text-sky-300 underline">{f.title} ↗</Link>
            </li>
          ))}
        </ul>
      </section>

      <Cta />
      <SiteFooterLinks />
    </main>
  );
}
