"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { DICTS, resolvePath, type Lang } from "./translations";

type Params = Record<string, string | number>;

type I18nContextValue = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, params?: Params) => string;
  tList: (key: string) => string[];
};

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = "hg-lang";

function resolveList(dict: Record<string, any>, path: string): string[] {
  const parts = path.split(".");
  let cur: any = dict;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return [];
    cur = cur[p];
  }
  return Array.isArray(cur) ? (cur as string[]) : [];
}

function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) =>
    params[k] !== undefined ? String(params[k]) : `{${k}}`
  );
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // SSR and first client render are always "en" to avoid hydration mismatch;
  // the stored / browser preference is applied after mount.
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    let finalLang: Lang = "en";
    const saved = (typeof window !== "undefined" &&
      window.localStorage.getItem(STORAGE_KEY)) as Lang | null;
    // 分享链接可带 ?lang=zh / ?lang=en，优先级高于本地存储，保证打开链接即还原语言。
    const urlLang =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("lang")
        : null;
    if (urlLang === "en" || urlLang === "zh") {
      finalLang = urlLang;
      window.localStorage.setItem(STORAGE_KEY, finalLang);
    } else if (saved === "en" || saved === "zh") {
      finalLang = saved;
    } else if (
      typeof navigator !== "undefined" &&
      navigator.language.toLowerCase().startsWith("zh")
    ) {
      finalLang = "zh";
    }
    if (finalLang !== lang) setLangState(finalLang);
    if (typeof document !== "undefined") {
      document.documentElement.lang = finalLang === "zh" ? "zh-CN" : "en";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, l);
      document.documentElement.lang = l === "zh" ? "zh-CN" : "en";
    }
  }, []);

  const t = useCallback(
    (key: string, params?: Params) => {
      const val = resolvePath(DICTS[lang], key);
      if (val === undefined) {
        // fall back to English, then to the raw key
        const enVal = resolvePath(DICTS.en, key);
        return interpolate(enVal ?? key, params);
      }
      return interpolate(val, params);
    },
    [lang]
  );

  const tList = useCallback(
    (key: string) => resolveList(DICTS[lang], key),
    [lang]
  );

  return (
    <I18nContext.Provider value={{ lang, setLang, t, tList }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within a LanguageProvider");
  }
  return ctx;
}
