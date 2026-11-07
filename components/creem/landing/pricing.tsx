"use client";

import clsx from "clsx";
import { Container } from "./container";
import { Check, Globe2, Clock3 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

function Plan({
  name,
  price,
  period,
  description,
  features,
  planned = [],
  featured = false,
  notLive = false,
  href,
  ctaLabel,
}: {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  /** 尚未实现的功能：必须明确标注「计划中」，不得与已上线权益混排。 */
  planned?: string[];
  featured?: boolean;
  notLive?: boolean;
  href: string;
  ctaLabel: string;
}) {
  const { t } = useI18n();
  return (
    <section
      className={clsx(
        "relative flex flex-col rounded-3xl p-7 sm:p-8 transition",
        featured
          ? "bg-[radial-gradient(150%_100%_at_50%_0%,rgba(56,189,248,0.16),rgba(6,18,31,0.9)_55%)] ring-1 ring-sky-400/40 shadow-2xl"
          : "bg-[#06121f] ring-1 ring-white/10"
      )}
    >
      {featured && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-sky-500 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#04101f]">
          {t("pricing.mostPopular")}
        </span>
      )}
      {notLive && (
        <span className="absolute right-5 top-5 inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-1 text-[10px] font-medium text-amber-200">
          <Clock3 className="h-3 w-3" />
          {t("pricing.notLive")}
        </span>
      )}
      <h3 className="editorial text-xl text-white">{name}</h3>
      <p className="mt-2 text-sm text-slate-400 min-h-[40px]">{description}</p>
      <p className="mt-5 flex items-baseline gap-1">
        <span className="editorial text-5xl font-light text-white">{price}</span>
        {period && <span className="text-sm text-slate-400">{period}</span>}
      </p>
      <ul role="list" className="mt-7 flex flex-col gap-y-3 text-sm text-slate-300 flex-1">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-3">
            <Check className={clsx("mt-0.5 h-4 w-4 flex-none", featured ? "text-brand" : "text-slate-500")} />
            <span>{feature}</span>
          </li>
        ))}
        {planned.map((feature) => (
          <li key={feature} className="flex items-start gap-3 text-slate-500">
            <Clock3 className="mt-0.5 h-4 w-4 flex-none text-slate-600" />
            <span>
              {feature}
              <span className="ml-2 inline-block rounded border border-slate-600/60 px-1.5 py-0.5 align-middle text-[10px] text-slate-500">
                {t("pricing.planned")}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <a
        href={href}
        className={clsx(
          "mt-8 block rounded-xl px-4 py-3 text-center text-sm font-semibold transition",
          featured
            ? "bg-sky-500 hover:bg-sky-400 text-[#04101f]"
            : "bg-white/5 hover:bg-white/10 text-white ring-1 ring-white/15"
        )}
      >
        {ctaLabel}
      </a>
    </section>
  );
}

export function Pricing() {
  const { t, tList } = useI18n();
  return (
    <section id="pricing" aria-label="Pricing" className="relative py-20 sm:py-32">
      <Container>
        <div className="max-w-2xl">
          <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-brand">
            {t("pricing.eyebrow")}
          </div>
          <h2 className="editorial mt-4 text-3xl sm:text-4xl lg:text-5xl text-white leading-[1.08]">
            {t("pricing.title")}
          </h2>
          <p className="mt-5 text-lg text-slate-300 leading-relaxed">
            {t("pricing.intro")}
          </p>
        </div>

        <div className="mt-14 grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-3">
          <Plan
            name="Wanderer"
            price={t("pricing.free")}
            period=""
            description={t("pricing.wandererDesc")}
            href="/explore"
            features={tList("pricing.wandererFeatures")}
            ctaLabel={t("pricing.startFree")}
          />
          <Plan
            featured
            name="Voyager"
            price={t("pricing.tba")}
            period=""
            description={t("pricing.voyagerDesc")}
            href="/explore"
            notLive
            features={tList("pricing.voyagerFeatures")}
            planned={tList("pricing.voyagerPlanned")}
            ctaLabel={t("pricing.startFree")}
          />
          <Plan
            name="Historian"
            price={t("pricing.tba")}
            period=""
            description={t("pricing.historianDesc")}
            href="/explore"
            notLive
            features={tList("pricing.historianFeatures")}
            planned={tList("pricing.historianPlanned")}
            ctaLabel={t("pricing.startFree")}
          />
        </div>

        <p className="mx-auto mt-8 max-w-3xl rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4 text-center text-sm leading-relaxed text-slate-400">
          {t("pricing.honestNote")}
        </p>
        <p className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-500">
          <Globe2 className="h-4 w-4 text-brand" />
          {t("pricing.checkout")}
        </p>
      </Container>
    </section>
  );
}
