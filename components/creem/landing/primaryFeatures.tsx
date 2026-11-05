"use client";

import {
  Globe2,
  Sparkles,
  Mail,
  Landmark,
  Database,
  Compass,
} from "lucide-react";
import { Container } from "./container";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

export function PrimaryFeatures() {
  const { t } = useI18n();
  const features = [
    {
      icon: Globe2,
      title: t("features.interactiveTitle"),
      description: t("features.interactiveDesc"),
    },
    {
      icon: Sparkles,
      title: t("features.askTitle"),
      description: t("features.askDesc"),
    },
    {
      icon: Mail,
      title: t("features.inboxTitle"),
      description: t("features.inboxDesc"),
    },
    {
      icon: Landmark,
      title: t("features.heritageTitle"),
      description: t("features.heritageDesc"),
    },
    {
      icon: Database,
      title: t("features.authorityTitle"),
      description: t("features.authorityDesc"),
    },
    {
      icon: Compass,
      title: t("features.discoveryTitle"),
      description: t("features.discoveryDesc"),
    },
  ];

  return (
    <section id="features" className="relative py-20 sm:py-28">
      <Container>
        <div className="max-w-2xl">
          <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-brand">
            {t("features.eyebrow")}
          </div>
          <h2 className="editorial mt-4 text-3xl sm:text-4xl lg:text-5xl text-white leading-[1.08]">
            {t("features.title")}
          </h2>
          <p className="mt-5 text-lg text-slate-300 leading-relaxed">
            {t("features.intro")}
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <div
              key={feature.title}
              className={cn(
                "group relative bg-[#06121f] p-7 transition-colors duration-300 hover:bg-[#0a1a2c]"
              )}
            >
              <div className="mb-5 grid h-11 w-11 place-items-center rounded-xl bg-sky-500/10 ring-1 ring-sky-400/20 text-brand transition group-hover:bg-sky-500/20">
                <feature.icon className="h-5 w-5" />
              </div>
              <h3 className="editorial text-xl text-white">{feature.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">
                {feature.description}
              </p>
              <span className="absolute right-5 top-5 font-mono text-xs text-slate-600">
                {String(i + 1).padStart(2, "0")}
              </span>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
