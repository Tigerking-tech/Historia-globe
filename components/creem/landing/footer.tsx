"use client";

import Link from "next/link";
import { Container } from "./container";
import { Globe2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function Footer() {
  const { t } = useI18n();
  const footerNav = [
    {
      title: t("footer.product"),
      links: [
        { label: t("nav.explore"), href: "/explore" },
        { label: t("nav.features"), href: "#features" },
        { label: t("nav.askHistoria"), href: "#ai" },
        { label: t("nav.pricing"), href: "#pricing" },
      ],
    },
    {
      title: t("footer.company"),
      links: [
        { label: t("footer.about"), href: "#" },
        { label: t("nav.signin"), href: "/signin" },
        { label: t("nav.getStarted"), href: "/signup" },
      ],
    },
    {
      title: t("footer.data"),
      links: [
        { label: t("footer.wikipedia"), href: "https://www.wikipedia.org" },
        { label: t("footer.unesco"), href: "https://whc.unesco.org" },
      ],
    },
  ];

  return (
    <footer className="relative border-t border-white/10 py-14">
      <Container>
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Link href="/" className="flex items-center space-x-2">
              <span className="grid place-items-center h-8 w-8 rounded-lg bg-sky-500/15 ring-1 ring-sky-400/30 text-brand">
                <Globe2 className="w-4 h-4" />
              </span>
              <span className="editorial text-lg text-white tracking-tight">
                Historia<span className="text-brand"> Globe</span>
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm text-slate-400 leading-relaxed">
              {t("footer.desc")}
            </p>
          </div>

          {footerNav.map((col) => (
            <div key={col.title}>
              <h4 className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500">
                {col.title}
              </h4>
              <ul className="mt-4 space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-slate-400 transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>{t("footer.copyright", { year: new Date().getFullYear() })}</p>
          <p>{t("footer.notAffiliated")}</p>
        </div>
      </Container>
    </footer>
  );
}
