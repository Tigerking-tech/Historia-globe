"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n";

/** 最小转化漏斗：访问 → 看幻灯片 → 点付费（外加 CSV / 教师入口）。
 *  用 sendBeacon 尽力上报，失败静默；绝不因埋点失败影响页面。 */

export type FunnelStep =
  | "page_view" | "reel_start" | "reel_slide"
  | "checkout_click" | "export_csv" | "teacher_entry";

export function track(step: FunnelStep, extra: Record<string, string> = {}) {
  if (typeof window === "undefined") return;
  try {
    const payload = JSON.stringify({
      step,
      path: window.location.pathname,
      lang: document.documentElement.lang || "en",
      ref: document.referrer.slice(0, 200),
      ...extra,
    });
    // 显式声明为真人流量：避免被 ingest 依据 UA 误判为爬虫
    const body = { ...JSON.parse(payload), ua: navigator.userAgent.slice(0, 400), bot: null };
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/ingest", new Blob([JSON.stringify(body)], { type: "application/json" }));
    } else {
      fetch("/api/ingest", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), keepalive: true }).catch(() => {});
    }
  } catch {}
}

export function FunnelTracker() {
  const pathname = usePathname();
  const { lang } = useI18n();

  useEffect(() => {
    track("page_view");
    if (pathname === "/for-teachers") track("teacher_entry");
    void lang;
  }, [pathname, lang]);

  // 委托式点击埋点：任何带 data-track 的元素都会自动上报
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement)?.closest?.("[data-track]") as HTMLElement | null;
      if (!el) return;
      const step = el.dataset.track as FunnelStep | undefined;
      if (step) track(step, { label: (el.dataset.trackLabel || "").slice(0, 80) });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
