"use client";

import Link from "next/link";
import { Container } from "./container";
import { ArrowRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function CTA() {
  const { t } = useI18n();
  return (
    <section className="relative py-20 sm:py-28">
      <Container>
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(120%_120%_at_50%_-20%,rgba(56,189,248,0.18),rgba(6,18,31,0.95)_55%)] px-6 py-16 sm:px-12 sm:py-20 text-center">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_300px_at_80%_120%,rgba(251,191,36,0.08),transparent_60%)]" />
          <div className="relative">
            <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-brand">
              {t("cta.eyebrow")}
            </div>
            <h2 className="editorial mx-auto mt-4 max-w-2xl text-3xl sm:text-4xl lg:text-5xl text-white leading-[1.08]">
              {t("cta.title")}
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg text-slate-300 leading-relaxed">
              {t("cta.body")}
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/explore"
                className="inline-flex items-center gap-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-[#04101f] font-semibold px-6 py-3 text-sm transition"
              >
                {t("cta.explore")}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/signup"
                className="inline-flex rounded-xl border border-white/15 hover:border-white/30 text-white px-6 py-3 text-sm transition"
              >
                {t("cta.createAccount")}
              </Link>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
