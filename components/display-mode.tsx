"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

/**
 * 显示模式：解决「一套深色科技风打天下」与不同人群审美冲突。
 * - dark    默认，夜间沉浸（普通用户 / 研究者）
 * - light   浅色高对比，户外强光手机（旅行者）
 * - present 浅色 + 大字号，教室投影（教师）
 * 通过 <html data-hg-mode> 驱动 globals.css 的覆盖规则，不改动各组件的类名。
 */
export type DisplayMode = "dark" | "light" | "present";

const STORAGE_KEY = "hg-display";
const MODES: DisplayMode[] = ["dark", "light", "present"];
const GLYPH: Record<DisplayMode, string> = { dark: "◐", light: "☀", present: "Aa" };

type Ctx = { mode: DisplayMode; setMode: (m: DisplayMode) => void };
const DisplayContext = createContext<Ctx>({ mode: "dark", setMode: () => {} });

function isMode(v: string | null): v is DisplayMode {
  return v === "dark" || v === "light" || v === "present";
}

export function DisplayProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<DisplayMode>("dark");

  useEffect(() => {
    let initial: DisplayMode = "dark";
    const url = new URLSearchParams(window.location.search).get("display");
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (isMode(url)) initial = url;
    else if (isMode(saved)) initial = saved;
    setModeState(initial);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.hgMode = mode;
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {}
  }, [mode]);

  const setMode = useCallback((m: DisplayMode) => setModeState(m), []);
  return (
    <DisplayContext.Provider value={{ mode, setMode }}>
      {children}
    </DisplayContext.Provider>
  );
}

export function useDisplayMode() {
  return useContext(DisplayContext);
}

export function DisplayToggle() {
  const { mode, setMode } = useDisplayMode();
  const { t } = useI18n();
  return (
    <div
      className="glass flex items-center gap-0.5 rounded-lg p-0.5 text-xs"
      role="group"
      aria-label={t("display.label")}
    >
      {MODES.map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => setMode(m)}
          aria-pressed={mode === m}
          title={t(`display.${m}`)}
          className={`min-w-[26px] rounded-md px-1.5 py-1 text-[11px] leading-none transition ${
            mode === m
              ? "bg-sky-500 text-[#04101f] font-semibold"
              : "text-slate-300 hover:text-white"
          }`}
        >
          {GLYPH[m]}
          <span className="sr-only">{t(`display.${m}`)}</span>
        </button>
      ))}
    </div>
  );
}
