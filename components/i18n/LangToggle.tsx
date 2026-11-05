"use client";

import { useI18n } from "@/lib/i18n";

export function LangToggle() {
  const { lang, setLang } = useI18n();
  return (
    <div className="glass flex items-center gap-0.5 rounded-lg p-0.5 text-xs">
      <button
        type="button"
        onClick={() => setLang("en")}
        className={`rounded-md px-2 py-1 transition ${
          lang === "en"
            ? "bg-sky-500 text-[#04101f] font-semibold"
            : "text-slate-300 hover:text-white"
        }`}
        aria-pressed={lang === "en"}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLang("zh")}
        className={`rounded-md px-2 py-1 transition ${
          lang === "zh"
            ? "bg-sky-500 text-[#04101f] font-semibold"
            : "text-slate-300 hover:text-white"
        }`}
        aria-pressed={lang === "zh"}
      >
        中文
      </button>
    </div>
  );
}
