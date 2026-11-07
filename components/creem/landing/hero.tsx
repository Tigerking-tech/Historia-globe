"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Globe from "@/components/globe/Globe";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

// A handful of famous, geolocated events to light up the hero globe.
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

const fadeInUp = {
  hidden: { y: 36, opacity: 0 },
  visible: (d: number = 0) => ({
    y: 0,
    opacity: 1,
    transition: { ease: "easeOut", duration: 0.6, delay: d },
  }),
};

export default function Hero() {
  const [mounted, setMounted] = useState(false);
  const { t, lang } = useI18n();
  useEffect(() => setMounted(true), []);

  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_600px_at_75%_-10%,rgba(56,189,248,0.12),transparent_55%),radial-gradient(700px_500px_at_0%_100%,rgba(251,191,36,0.07),transparent_55%)]" />
      <div className="relative mx-auto max-w-7xl px-5 sm:px-8 pt-16 md:pt-24 pb-20 md:pb-28">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeInUp}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-mono uppercase               tracking-[0.25em] text-sky-300"
            >
              {t("hero.badge")}
            </motion.div>
            <motion.h1
              initial="hidden"
              animate="visible"
              variants={fadeInUp}
              custom={0.05}
              className="editorial mt-5 text-4xl sm:text-5xl lg:text-6xl leading-[1.05] text-white"
            >
              {t("hero.title1")}
              <br />
              {t("hero.title2")}
            </motion.h1>
            <motion.p
              initial="hidden"
              animate="visible"
              variants={fadeInUp}
              custom={0.15}
              className="mt-6 text-lg text-slate-300 max-w-xl leading-relaxed"
            >
              {t("hero.subtitle")}
            </motion.p>
            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeInUp}
              custom={0.25}
              className="mt-8 flex flex-wrap items-center gap-4"
            >
              <Link
                href="/explore"
                className="rounded-xl bg-sky-500 hover:bg-sky-400 text-[#04101f] font-semibold px-6 py-3 text-sm transition"
              >
                {t("hero.ctaExplore")}
              </Link>
              <a
                href="#pricing"
                data-track="checkout_click"
                data-track-label="hero-pricing"
                className="rounded-xl border border-white/15 hover:border-white/30 text-white px-6 py-3 text-sm transition"
              >
                {t("hero.ctaPricing")}
              </a>
              <a
                href={`/reel.html?q=911&lang=${lang}`}
                data-track="reel_start"
                data-track-label="hero-reel"
                className="rounded-xl border border-amber-400/40 bg-amber-400/10 hover:bg-amber-400/20 text-amber-200 px-6 py-3 text-sm transition"
              >
                ▤ {t("hero.ctaReel")}
              </a>
            </motion.div>
            <motion.p
              initial="hidden"
              animate="visible"
              variants={fadeInUp}
              custom={0.35}
              className="mt-6 text-xs text-slate-500"
            >
              {t("hero.openData")}
            </motion.p>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="relative h-[380px] sm:h-[460px] lg:h-[520px]"
          >
            {mounted && (
              <Globe events={SHOWCASE} enableDrag height={520} className="absolute inset-0" />
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
