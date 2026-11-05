"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/creem/landing/container";
import { Globe2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { LangToggle } from "@/components/i18n/LangToggle";

export function MainNav() {
  const { t } = useI18n();
  return (
    <nav className="sticky top-0 z-50 w-full overflow-x-hidden border-b border-white/10 bg-[#04101f]/80 backdrop-blur supports-[backdrop-filter]:bg-[#04101f]/60">
      <Container>
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center space-x-2 group">
              <span className="grid place-items-center h-8 w-8 rounded-lg bg-sky-500/15 ring-1 ring-sky-400/30 text-brand group-hover:bg-sky-500/25 transition">
                <Globe2 className="w-4 h-4" />
              </span>
              <span className="editorial text-lg text-white tracking-tight">
                Historia<span className="text-brand"> Globe</span>
              </span>
            </Link>
            <div className="hidden md:flex items-center gap-7">
              <Link
                href="/explore"
                className="text-sm text-slate-300 transition-colors hover:text-white"
              >
                {t("nav.explore")}
              </Link>
              <Link
                href="#features"
                className="text-sm text-slate-300 transition-colors hover:text-white"
              >
                {t("nav.features")}
              </Link>
              <Link
                href="#ai"
                className="text-sm text-slate-300 transition-colors hover:text-white"
              >
                {t("nav.askHistoria")}
              </Link>
              <Link
                href="#pricing"
                className="text-sm text-slate-300 transition-colors hover:text-white"
              >
                {t("nav.pricing")}
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3">
            <LangToggle />
            <div className="hidden sm:block">
              <Button variant="ghost" asChild className="text-slate-300 hover:text-white hover:bg-white/5">
                <Link href="/signin">{t("nav.signin")}</Link>
              </Button>
            </div>
            <Button asChild className="bg-sky-500 hover:bg-sky-400 text-[#04101f] font-semibold border-0">
              <Link href="/signup">{t("nav.getStarted")}</Link>
            </Button>
          </div>
        </div>
      </Container>
    </nav>
  );
}
