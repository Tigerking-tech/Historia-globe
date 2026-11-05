"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Globe from "@/components/globe/Globe";
import { Container } from "./container";
import { useI18n } from "@/lib/i18n";

const SHOWCASE = [
  { id: "s1", year: 1969, title: "Apollo 11 Moon landing", lat: 29.55, lon: -95.1, category: "space", place: "Houston" },
  { id: "s2", year: 1989, title: "Fall of the Berlin Wall", lat: 52.52, lon: 13.4, category: "politics", place: "Berlin" },
  { id: "s3", year: 1945, title: "Atomic bombing of Hiroshima", lat: 34.39, lon: 132.45, category: "war", place: "Hiroshima" },
  { id: "s4", year: 2001, title: "9/11 attacks", lat: 40.71, lon: -74.01, category: "terrorism", place: "New York" },
  { id: "s5", year: 1776, title: "US Declaration of Independence", lat: 39.95, lon: -75.17, category: "politics", place: "Philadelphia" },
  { id: "s6", year: 1953, title: "First ascent of Everest", lat: 27.98, lon: 86.92, category: "exploration", place: "Everest" },
  { id: "s7", year: 1961, title: "Gagarin in space", lat: 45.96, lon: 63.31, category: "space", place: "Baikonur" },
  { id: "s8", year: 1945, title: "Victory in Europe Day", lat: 52.52, lon: 13.4, category: "war", place: "Berlin" },
  { id: "s9", year: 1947, title: "India gains independence", lat: 28.61, lon: 77.21, category: "politics", place: "New Delhi" },
  { id: "s10", year: 1991, title: "Dissolution of the Soviet Union", lat: 55.75, lon: 37.62, category: "politics", place: "Moscow" },
  { id: "s11", year: 1914, title: "Archduke Ferdinand assassinated", lat: 43.86, lon: 18.41, category: "war", place: "Sarajevo" },
  { id: "s12", year: 1968, title: "Prague Spring crushed", lat: 50.08, lon: 14.44, category: "war", place: "Prague" },
];

export function ExplorerPreview() {
  const [mounted, setMounted] = useState(false);
  const { t } = useI18n();
  useEffect(() => setMounted(true), []);

  const bullets = [t("explorer.bullet1"), t("explorer.bullet2"), t("explorer.bullet3")];

  return (
    <section className="relative py-20 sm:py-28">
      <Container>
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-brand">
              {t("explorer.eyebrow")}
            </div>
            <h2 className="editorial mt-4 text-3xl sm:text-4xl lg:text-5xl text-white leading-[1.08]">
              {t("explorer.title")}
            </h2>
            <p className="mt-5 text-lg text-slate-300 leading-relaxed">
              {t("explorer.body")}
            </p>
            <ul className="mt-7 space-y-3">
              {bullets.map((b) => (
                <li key={b} className="flex items-start gap-3 text-sm text-slate-300">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-brand shrink-0" />
                  {b}
                </li>
              ))}
            </ul>
            <Link
              href="/explore"
              className="mt-8 inline-flex rounded-xl bg-sky-500 hover:bg-sky-400 text-[#04101f] font-semibold px-6 py-3 text-sm transition"
            >
              {t("explorer.cta")}
            </Link>
          </div>

          <div className="relative h-[360px] sm:h-[440px] rounded-2xl border border-white/10 bg-[#06121f] overflow-hidden">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_400px_at_70%_-10%,rgba(56,189,248,0.12),transparent_60%)]" />
            {mounted && (
              <Globe events={SHOWCASE} enableDrag height={440} className="absolute inset-0" />
            )}
            <div className="pointer-events-none absolute left-4 bottom-4 glass rounded-lg px-3 py-2 text-[11px] text-slate-300">
              <span className="text-heritage">●</span> {t("explorer.legendHeritage")} &nbsp;
              <span className="text-sky-400">●</span> {t("explorer.legendEvents")}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
