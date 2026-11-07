import type { Metadata } from "next";
import Link from "next/link";
import { getSEOTags } from "@/lib/seo";
import {
  Breadcrumbs, AnswerBox, PriceNote, Cta, SiteFooterLinks, JsonLd,
} from "@/components/content/ContentFrame";
import { stats } from "@/lib/content";

export const metadata: Metadata = getSEOTags({
  title: "For teachers & homeschool · Historia Globe",
  description:
    "A free, projector-friendly history tool: presentation large-type mode, CSV export with clickable source links, and an interactive 3D globe for any date. No account needed.",
  canonicalUrlRelative: "/for-teachers",
});

const s = stats();

export default function ForTeachersPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 pb-24 pt-12 sm:px-8">
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: "Historia Globe for teachers and homeschool",
        audience: { "@type": "EducationalAudience", educationalRole: "teacher" },
        isAccessibleForFree: true,
      }} />
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "For teachers" }]} />
      <AnswerBox
        kicker="For teachers · homeschool · 课堂"
        title="History you can put on a projector"
        answer="Historia Globe gives a classroom a free, ad-free way to put any date's world history on a 3D globe. Turn on Presentation mode for large type and high contrast, export the day's events to CSV with clickable source links, and let students follow every claim back to Wikipedia. No account, no card, no student data collected."
        zhAnswer="Historia Globe 让课堂免费、无广告地把任意一天的世界史放到 3D 地球上。开启「演示模式」获得大字与高对比度，把当天事件连同可点击出处导出 CSV，让学生对每条说法都能回溯到维基百科。无需账号、无需绑卡，不采集学生数据。"
      />
      <PriceNote />

      <section className="mt-10">
        <h2 className="editorial text-xl text-white">Three things that work today</h2>
        <ul className="mt-4 space-y-4">
          <li className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <h3 className="text-sm font-semibold text-white">1 · Presentation mode / 演示大字</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              The display switch in the top navigation offers <strong>Dark / Light high-contrast / Presentation</strong>.
              Presentation uses a light background and enlarged type so a projected screen stays readable
              from the back of a room. Your choice persists across pages.
            </p>
            <Link href="/explore?display=present" className="mt-2 inline-block text-sm text-sky-300 underline">
              Open the globe directly in Presentation mode →
            </Link>
          </li>
          <li className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <h3 className="text-sm font-semibold text-white">2 · CSV export with sources / 含出处的导出</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              Export any date&apos;s events to CSV from the explorer. Each row carries year, title,
              description, place, coordinates and a clickable source URL — ready for a worksheet,
              a slide deck, or a citation exercise. Every event also has its own static page:{" "}
              <Link href="/on-this-day/07-20" className="text-sky-300 underline">e.g. July 20 ↗</Link>.
            </p>
          </li>
          <li className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <h3 className="text-sm font-semibold text-white">3 · Real photos, real credits / 真实史料与署名</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              The archival slideshow cycles through freely licensed historical photographs with
              per-image attribution and licence. We never replace a missing photo with an AI-generated
              image or a vector diagram — a useful lesson in source criticism by itself.{" "}
              <Link href="/reel.html?q=911" className="text-sky-300 underline">See the 9/11 slideshow ↗</Link>.
            </p>
          </li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="editorial text-xl text-white">A 20-minute lesson that needs no prep</h2>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-300">
          <li>Open <Link href="/explore?display=present" className="text-sky-300 underline">the globe in Presentation mode</Link> and pick today&apos;s date.</li>
          <li>Ask: why did events on the same calendar day happen on different continents? Use the day tour to fly between them.</li>
          <li>Click one event, open its Wikipedia source, and have students find one claim the description does not support.</li>
          <li>Export the day to CSV and assign each group one event to verify against a second source.</li>
          <li>Finish with the archival slideshow and discuss why provenance matters more than a dramatic picture.</li>
        </ol>
      </section>

      <section className="mt-10 rounded-xl border border-amber-400/25 bg-amber-400/[0.05] px-5 py-4">
        <h2 className="text-sm font-semibold text-amber-200">Honest limits / 如实说明</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-300">
          <li>
            The curated archive currently holds <strong>{s.events} verified events across {s.daysWithEvents} dates</strong>.
            Wikipedia / Wikidata records merge in automatically when the deployment can reach them;
            when they cannot, the page says so rather than presenting a partial day as complete.
          </li>
          <li>There are no classroom seats, rosters, gradebook or cloud sync yet. Those are on the roadmap, not shipped.</li>
          <li>Ask Historia currently weaves the day&apos;s events together; it does not provide per-sentence citations yet.</li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="editorial text-lg text-white">Feedback from the first 20 classrooms</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          We are looking for a small number of teachers and homeschool families to try this with real
          students. If a date, coordinate or credit is wrong, or the projector mode still fails your
          room, tell us through the{" "}
          <Link href="/legal/contact" className="text-sky-300 underline">contact page ↗</Link> — corrections
          are prioritised over new features.
        </p>
      </section>

      <Cta />
      <SiteFooterLinks />
    </main>
  );
}
