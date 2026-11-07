import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LEGAL_DOCS, getLegalDoc, SUPPORT_EMAIL, GITHUB_ISSUES } from "@/lib/legal";
import { getSEOTags } from "@/lib/seo";

export function generateStaticParams() {
  return LEGAL_DOCS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const doc = getLegalDoc(params.slug);
  if (!doc) return getSEOTags({ title: "Legal · Historia Globe" });
  return getSEOTags({
    title: `${doc.title} · Historia Globe`,
    description: doc.intro,
    canonicalUrlRelative: `/legal/${doc.slug}`,
  });
}

/** 服务端静态渲染：英文全文 + 中文全文都实打实输出在 HTML 里，
 *  爬虫不执行 JS 也能读到全部条款（哥飞 GEO 打法：第一屏直接给结论）。 */
export default function LegalPage({ params }: { params: { slug: string } }) {
  const doc = getLegalDoc(params.slug);
  if (!doc) notFound();

  return (
    <main className="mx-auto max-w-3xl px-5 pb-24 pt-12 sm:px-8">
      <nav className="mb-8 flex flex-wrap gap-2 text-xs text-slate-400" aria-label="Legal navigation">
        <Link href="/" className="hover:text-white">Home</Link>
        <span aria-hidden="true">/</span>
        {LEGAL_DOCS.map((d) => (
          <span key={d.slug} className="flex items-center gap-2">
            <Link
              href={`/legal/${d.slug}`}
              className={d.slug === doc.slug ? "text-sky-300" : "hover:text-white"}
            >
              {d.title}
            </Link>
            <span aria-hidden="true">·</span>
          </span>
        ))}
      </nav>

      <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-brand">
        Legal · Updated {doc.updated}
      </div>
      <h1 className="editorial mt-3 text-3xl sm:text-4xl text-white">{doc.title}</h1>
      <p className="mt-4 rounded-xl border border-sky-400/25 bg-sky-400/[0.06] px-4 py-3 text-sm leading-relaxed text-slate-200">
        {doc.intro}
      </p>
      <h2 className="editorial mt-2 text-xl text-slate-300">{doc.titleZh}</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">{doc.introZh}</p>

      <div className="mt-10 space-y-10">
        {doc.sections.map((s, i) => (
          <section key={i} className="border-t border-white/10 pt-7">
            <h2 className="editorial text-xl text-white">{i + 1}. {s.h}</h2>
            {s.body.map((p, j) => (
              <p key={j} className="mt-3 text-sm leading-[1.85] text-slate-300">{p}</p>
            ))}
            {/* 中文版本同样在静态 HTML 中，折叠只是视觉处理，不影响爬虫索引 */}
            <details className="mt-4 rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3">
              <summary className="cursor-pointer text-xs font-semibold text-sky-300">
                {s.hz} · 中文
              </summary>
              {s.bodyz.map((p, j) => (
                <p key={j} className="mt-3 text-sm leading-[1.85] text-slate-400" lang="zh-CN">{p}</p>
              ))}
            </details>
          </section>
        ))}
      </div>

      <section className="mt-12 rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="editorial text-lg text-white">Contact · 联系</h2>
        <p className="mt-2 text-sm text-slate-300">
          Email: <a className="text-sky-300 underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </p>
        <p className="mt-1 text-sm text-slate-300">
          Always reachable: <a className="text-sky-300 underline" href={GITHUB_ISSUES} rel="noopener noreferrer" target="_blank">GitHub Issues ↗</a>
        </p>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          Privacy · Terms · Refund · Contact are all available in the site footer. This site currently
          collects no payment; see the Refund policy for the exact status.
        </p>
      </section>

      <p className="mt-10 text-sm">
        <Link href="/" className="text-sky-300 hover:underline">← Back to Historia Globe</Link>
      </p>
    </main>
  );
}
