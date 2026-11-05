"use client";

import { Sparkles, ArrowRight } from "lucide-react";
import { Container } from "./container";
import { useI18n } from "@/lib/i18n";

export function AIFeature() {
  const { t } = useI18n();
  const sampleQuestion = t("ai.sampleQuestion");
  const sampleAnswer = t("ai.sampleAnswer");

  return (
    <section id="ai" className="relative py-20 sm:py-28">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(800px_500px_at_20%_0%,rgba(56,189,248,0.08),transparent_60%)]" />
      <Container>
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-[11px] font-mono uppercase tracking-[0.2em] text-amber-300">
            <Sparkles className="h-3.5 w-3.5" /> {t("ai.badge")}
          </div>
          <h2 className="editorial mt-5 text-3xl sm:text-4xl lg:text-5xl text-white leading-[1.08]">
            {t("ai.title")}
          </h2>
          <p className="mt-5 text-lg text-slate-300 leading-relaxed">
            {t("ai.body")}
          </p>
        </div>

        <div className="mt-12 grid lg:grid-cols-2 gap-6">
          <div className="glass rounded-2xl p-6">
            <div className="text-[11px] uppercase tracking-wider text-slate-400">{t("ai.youAsk")}</div>
            <p className="editorial mt-2 text-lg text-white">{sampleQuestion}</p>
            <div className="mt-5 flex items-center gap-2 text-xs text-brand">
              {t("ai.readsEvents")}
              <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </div>

          <div className="glass rounded-2xl border-amber-400/20 p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <div className="text-[11px] uppercase tracking-wider text-amber-300/80">{t("ai.historiaAnswers")}</div>
            </div>
            <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">
              {sampleAnswer}
            </p>
          </div>
        </div>

        <p className="mt-6 text-sm text-slate-500">
          {t("ai.footnote")}
        </p>
      </Container>
    </section>
  );
}
