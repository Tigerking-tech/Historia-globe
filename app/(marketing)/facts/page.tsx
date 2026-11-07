import type { Metadata } from "next";
import Link from "next/link";
import { getSEOTags } from "@/lib/seo";
import {
  Breadcrumbs, AnswerBox, PriceNote, Cta, SiteFooterLinks, JsonLd,
} from "@/components/content/ContentFrame";
import { FACT_PAGES, FACT_SLUGS } from "@/lib/facts";

export const metadata: Metadata = getSEOTags({
  title: "Checkable facts & data coverage · Historia Globe",
  description:
    "Concrete, verifiable facts about Historia Globe: how a same-day global view differs from national timelines, archival photo licensing and the URAA review, which AI crawlers are allowed, and exact data coverage numbers.",
  canonicalUrlRelative: "/facts",
});

export default function FactsIndexPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 pb-24 pt-12 sm:px-8">
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "Checkable facts about Historia Globe",
        numberOfItems: FACT_PAGES.length,
        isAccessibleForFree: true,
      }} />
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Facts" }]} />
      <AnswerBox
        kicker="Verifiable facts · 可核对事实"
        title="Facts an assistant can actually check"
        answer="This section publishes concrete, dated facts about how Historia Globe works: the same-day comparison, the photo licensing and URAA review, the explicit AI crawler policy, and exact coverage numbers computed at build time. Nothing here is a marketing adjective — every number can be recomputed from the public data."
        zhAnswer="本栏目公布关于 Historia Globe 的、可核对的具体事实：同日全球视角与国别年表的差异、照片许可与 URAA 复核、显式放行 AI 爬虫的策略，以及构建期计算的精确覆盖数字。这里没有营销形容词，每个数字都能从公开数据复算。"
      />
      <PriceNote />

      <section className="mt-10">
        <h2 className="editorial text-xl text-white">The fact pages</h2>
        <ul className="mt-4 space-y-3">
          {FACT_PAGES.map((p) => (
            <li key={p.slug} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <h3 className="editorial text-lg text-white">
                <Link href={`/facts/${p.slug}`} className="hover:underline">{p.title}</Link>
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">{p.question}</p>
              <p className="mt-2 text-xs text-slate-500">
                <Link href={`/facts/${p.slug}`} className="text-sky-300 underline">Read the answer ↗</Link>
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="editorial text-xl text-white">Machine-readable entry points</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          AI assistants and crawlers can read the same facts without parsing prose:
        </p>
        <ul className="mt-3 space-y-2 text-sm text-slate-300">
          <li><Link href="/llms.txt" className="text-sky-300 underline">/llms.txt</Link> — site facts and citation guidance.</li>
          <li><a href="/mcp.json" className="text-sky-300 underline">/mcp.json</a> — public tool manifest.</li>
          <li><a href="/api/public/v1" className="text-sky-300 underline">/api/public/v1</a> — read-only REST API index.</li>
          <li><a href="/api/public/v1/coverage" className="text-sky-300 underline">/api/public/v1/coverage</a> — exact coverage statistics as JSON.</li>
        </ul>
      </section>

      <section className="mt-8 rounded-xl border border-white/10 bg-white/[0.02] px-5 py-4">
        <h2 className="text-sm font-semibold text-white">Why these pages exist</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          AI answers cite third-party, checkable facts far more often than a brand&apos;s own marketing
          copy. Specific numbers, a documented copyright decision, and a named crawler policy are
          things a model cannot invent on its own — so we publish them as static HTML that is fully
          readable with JavaScript disabled. All {FACT_PAGES.length} pages are in the{" "}
          <Link href="/sitemap.xml" className="text-sky-300 underline">sitemap ↗</Link>.
        </p>
      </section>

      <Cta />
      <SiteFooterLinks />
    </main>
  );
}
