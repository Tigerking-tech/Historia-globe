"use client";

import clsx from "clsx";
import { Container } from "./container";
import { Check, Globe2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

function Plan({
  name,
  price,
  period,
  description,
  features,
  featured = false,
  href,
  ctaLabel,
}: {
  name: string;
  price: string;
  period: string;
  description: string;
  features: Array<string>;
  featured?: boolean;
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
      <h3 className="editorial text-xl text-white">{name}</h3>
      <p className="mt-2 text-sm text-slate-400 min-h-[40px]">{description}</p>
      <p className="mt-5 flex items-baseline gap-1">
        <span className="editorial text-5xl font-light text-white">{price}</span>
        <span className="text-sm text-slate-400">{period}</span>
      </p>
      <ul role="list" className="mt-7 flex flex-col gap-y-3 text-sm text-slate-300 flex-1">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-3">
            <Check className={clsx("mt-0.5 h-4 w-4 flex-none", featured ? "text-brand" : "text-slate-500")} />
            <span>{feature}</span>
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
            href="/signup"
            features={tList("pricing.wandererFeatures")}
            ctaLabel={t("pricing.startFree")}
          />
          <Plan
            featured
            name="Voyager"
            price="$5"
            period={t("pricing.perMonth")}
            description={t("pricing.voyagerDesc")}
            href="/signup"
            features={tList("pricing.voyagerFeatures")}
            ctaLabel={t("pricing.subscribe")}
          />
          <Plan
            name="Historian"
            price="$12"
            period={t("pricing.perMonth")}
            description={t("pricing.historianDesc")}
            href="/signup"
            features={tList("pricing.historianFeatures")}
            ctaLabel={t("pricing.subscribe")}
          />
        </div>

        <p className="mt-10 flex items-center justify-center gap-2 text-sm text-slate-500">
          <Globe2 className="h-4 w-4 text-brand" />
          {t("pricing.checkout")}
        </p>
      </Container>
    </section>
  );
}
