import Link from "next/link";
import config from "@/config";

/** 静态内容页共用骨架。
 *  服务端渲染，无客户端 JS 依赖：爬虫（含 AI 爬虫）直接读到全部实质内容。
 *  第一屏明确给结论 + 说明收不收费（哥飞 GEO 打法）。 */

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav className="mb-8 flex flex-wrap items-center gap-2 text-xs text-slate-400" aria-label="Breadcrumb">
      <Link href="/" className="hover:text-white">Home</Link>
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-2">
          <span aria-hidden="true">/</span>
          {it.href ? (
            <Link href={it.href} className="hover:text-white">{it.label}</Link>
          ) : (
            <span className="text-sky-300">{it.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function SiteFooterLinks() {
  return (
    <footer className="mt-16 border-t border-white/10 pt-6 text-xs leading-relaxed text-slate-500">
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Link href="/legal/privacy" className="hover:text-white">Privacy</Link>
        <Link href="/legal/terms" className="hover:text-white">Terms</Link>
        <Link href="/legal/refund" className="hover:text-white">Refund</Link>
        <Link href="/legal/contact" className="hover:text-white">Contact</Link>
        <Link href="/for-teachers" className="hover:text-white">For teachers</Link>
        <Link href="/historical-boundaries" className="hover:text-white">Historical borders</Link>
        <Link href="/facts" className="hover:text-white">Facts &amp; coverage</Link>
        <Link href="/llms.txt" className="hover:text-white">llms.txt</Link>
        <Link href="/sitemap.xml" className="hover:text-white">Sitemap</Link>
      </div>
      <p className="mt-3">
        © {new Date().getFullYear()} {config.appName}. Built on open data from Wikipedia, Wikimedia
        Commons, UNESCO, Esri, Panoramax and Open-Meteo. Not affiliated with UNESCO.
      </p>
    </footer>
  );
}

/** 第一屏结论条：直接回答「这一天有什么 / 要不要钱」。 */
export function AnswerBox({
  kicker,
  title,
  answer,
  zhAnswer,
}: {
  kicker: string;
  title: string;
  answer: string;
  zhAnswer: string;
}) {
  return (
    <header>
      <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-brand">{kicker}</div>
      <h1 className="editorial mt-3 text-3xl leading-tight text-white sm:text-4xl">{title}</h1>
      <div className="mt-5 rounded-xl border border-sky-400/25 bg-sky-400/[0.06] px-5 py-4">
        <p className="text-base font-medium leading-relaxed text-slate-100">{answer}</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-400" lang="zh-CN">{zhAnswer}</p>
      </div>
    </header>
  );
}

/** 免费 / 收费状态：Chrome/AI 爬虫一进页面就能读到，不做误导。 */
export function PriceNote() {
  return (
    <section className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4" aria-label="Pricing status">
      <h2 className="text-sm font-semibold text-white">Is this free? · 收费说明</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-300">
        <strong className="text-emerald-300">Free today.</strong> This page, the interactive globe,
        source links, CSV export, display modes and the archival slideshow work with no account and
        no card. A planned <strong>one-time $4 Archival Pass</strong> (no subscription, no auto-renewal)
        is shown on the pricing page, but <strong className="text-amber-300">checkout is not enabled yet —
        this site collects no payment today.</strong> Free tier details:{" "}
        <Link href="/#pricing" className="text-sky-300 underline">pricing</Link>.
      </p>
      <p className="mt-1 text-xs leading-relaxed text-slate-500" lang="zh-CN">
        目前全部免费，无需账号或绑卡。计划中的一次性 4 美元「史料通行证」尚未开售，本站当前不收取任何费用。
      </p>
    </section>
  );
}

/** 数据来源诚实说明：本地策展 + 外部源上线后补齐，不伪装成完整数据。 */
export function SourceNote({ count }: { count: number }) {
  return (
    <p className="mt-4 text-xs leading-relaxed text-slate-500">
      Data source: these {count} record{count === 1 ? "" : "s"} come from our verified curated
      archive, which is always available. In production, Wikipedia and Wikidata events are merged in
      automatically when reachable; when they are not, we say so rather than presenting a partial day
      as complete. Every record links to its Wikipedia search page.{" "}
      <Link href="/legal/privacy" className="underline hover:text-slate-300">How we handle data ↗</Link>
    </p>
  );
}

export function Cta() {
  return (
    <div className="mt-8 flex flex-wrap gap-3">
      <Link
        href="/explore"
        className="rounded-xl bg-sky-500 px-5 py-3 text-sm font-semibold text-[#04101f] hover:bg-sky-400"
      >
        Explore this on the 3D globe →
      </Link>
      <Link
        href="/reel.html?q=911"
        className="rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
      >
        ▤ Watch the archival photo slideshow
      </Link>
    </div>
  );
}

/** JSON-LD：给搜索引擎 / AI 助手结构化事实，减少误读。 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
