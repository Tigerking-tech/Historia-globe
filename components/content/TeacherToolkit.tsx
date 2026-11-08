"use client";

// 教师闭环（轻量版）：不需要账号、不写数据库、不写本地文件。
// 数据全部来自公开只读 API；导出与练习生成都在浏览器内完成，
// 因此 Vercel Serverless 只读文件系统下同样可用。
//
// 诚实边界：这里没有课堂席位、名册、评分或云端同步。意愿收集走公开
// GitHub Issue 预填链接，明确不收集邮箱与学生信息。

import { useMemo, useState } from "react";

type PublicEvent = {
  title: string;
  year: number;
  description?: string;
  place?: string;
  category?: string;
  sourceUrl: string;
  sourceType: string;
  eventPage?: string;
  datePage?: string;
};

type DateResponse = {
  ok: boolean;
  error?: string;
  date?: string;
  label?: string;
  total?: number;
  curatedCount?: number;
  supplementalCount?: number;
  curated?: PublicEvent[];
  supplemental?: PublicEvent[];
};

const ISSUE_NEW = "https://github.com/Tigerking-tech/Historia-globe/issues/new";
const DEFAULT_DATE = "07-20";
const DATE_RE = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

function yearLabel(y: number): string {
  return y < 0 ? `${-y} BCE` : String(y);
}

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

function buildCsv(rows: PublicEvent[]): string {
  const header = ["group", "year", "title", "description", "place", "sourceUrl", "sourceType", "eventPage"];
  const lines = [header.map(csvCell).join(",")];
  for (const e of rows) {
    lines.push([
      e.category || e.sourceType,
      yearLabel(e.year),
      e.title,
      e.description || "",
      e.place || "",
      e.sourceUrl,
      e.sourceType,
      e.eventPage || "",
    ].map(csvCell).join(","));
  }
  // BOM 让 Excel 正确识别 UTF-8（含中文/重音字符）。
  return "\ufeff" + lines.join("\r\n");
}

export function TeacherToolkit() {
  const [date, setDate] = useState(DEFAULT_DATE);
  const [data, setData] = useState<DateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [showWorksheet, setShowWorksheet] = useState(false);

  const [role, setRole] = useState("Teacher / 教师");
  const [price, setPrice] = useState("Free only / 只用免费版");
  const [want, setWant] = useState("Printable source-check worksheet / 可打印的出处核对练习");

  const events = useMemo<PublicEvent[]>(() => {
    if (!data?.ok) return [];
    return [...(data.curated || []), ...(data.supplemental || [])];
  }, [data]);

  const grouped = useMemo(() => {
    const m = new Map<string, PublicEvent[]>();
    for (const e of events) {
      const k = e.category || e.sourceType;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(e);
    }
    return Array.from(m.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [events]);

  const shareUrl = `/explore?date=${date}&display=present`;

  async function load() {
    const d = date.trim();
    if (!DATE_RE.test(d)) {
      setError("Use MM-DD, e.g. 07-20 · 请填 MM-DD，例如 07-20");
      setData(null);
      return;
    }
    setLoading(true);
    setError("");
    setShowWorksheet(false);
    try {
      const res = await fetch(`/api/public/v1/on-this-day/${d}`, { cache: "no-store" });
      const json = (await res.json()) as DateResponse;
      if (!res.ok || !json.ok) {
        setError(json.error || `Request failed (${res.status})`);
        setData(null);
      } else {
        setData(json);
      }
    } catch {
      setError("Could not reach the public API. It is free and needs no key — try again in a moment.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  async function copyShare() {
    const full = typeof window !== "undefined" ? `${window.location.origin}${shareUrl}` : shareUrl;
    try {
      await navigator.clipboard.writeText(full);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  function downloadCsv() {
    if (!events.length) return;
    const blob = new Blob([buildCsv(events)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `historia-${date}-sources.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const issueUrl = useMemo(() => {
    const title = `[classroom] ${role} · ${price}`;
    const body = [
      `Role: ${role}`,
      `Willing to pay: ${price}`,
      `Most wanted: ${want}`,
      `Date tried: ${date}`,
      "",
      "Submitted from the /for-teachers toolkit. This form deliberately collects no email and no student data.",
      " pricing fields are indicative only — payment is not enabled on this site.",
    ].join("\n");
    return `${ISSUE_NEW}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
  }, [role, price, want, date]);

  const card = "rounded-xl border border-white/10 bg-white/[0.02] p-4";
  const btn = "rounded-lg border border-sky-400/40 bg-sky-400/10 px-3 py-1.5 text-xs font-semibold text-sky-200 hover:bg-sky-400/20 disabled:opacity-40";
  const field = "rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm text-slate-200";

  return (
    <section className="mt-10" aria-label="Classroom toolkit">
      <h2 className="editorial text-xl text-white">Classroom toolkit · 课堂工具（无需账号）</h2>
      <p className="mt-2 text-xs leading-relaxed text-slate-500">
        Everything below runs in your browser against the free public API. No login, no student data,
        no cloud storage. Each row keeps its source link so the worksheet stays verifiable.
      </p>

      <div className="mt-5 space-y-4">
        {/* 1 · 选日期 */}
        <div className={card}>
          <h3 className="text-sm font-semibold text-white">1 · Pick a date / 选一天</h3>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={date}
              onChange={(e) => setDate(e.target.value)}
              placeholder="MM-DD"
              aria-label="Date in MM-DD format"
              className={`${field} w-28 font-mono`}
            />
            <button type="button" onClick={load} disabled={loading} className={btn}>
              {loading ? "Loading…" : "Load this day / 载入"}
            </button>
            {data?.ok && (
              <span className="text-xs text-slate-400">
                {data.label}: <strong className="text-slate-200">{data.total}</strong> events
                （{data.curatedCount} curated + {data.supplementalCount} supplemental）
              </span>
            )}
          </div>
          {error && <p className="mt-2 text-xs text-amber-200">{error}</p>}
        </div>

        {/* 2 · 核实练习 */}
        <div className={card}>
          <h3 className="text-sm font-semibold text-white">2 · Generate a source-check worksheet / 生成出处核对练习</h3>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            Picks up to 6 events from that day. For each one: open the source, find one claim in the
            description the page does not support, then verify it against a second source.
          </p>
          <button
            type="button"
            onClick={() => setShowWorksheet(true)}
            disabled={!events.length}
            className={`${btn} mt-3`}
          >
            Build worksheet / 生成练习
          </button>
          {showWorksheet && events.length > 0 && (
            <ol className="mt-4 space-y-3">
              {events.slice(0, 6).map((e, i) => (
                <li key={`${e.year}-${e.title}-${i}`} className="rounded-lg border border-white/10 bg-black/20 p-3">
                  <div className="text-xs font-semibold text-sky-300">
                    {i + 1} · {yearLabel(e.year)} · {e.category || e.sourceType}
                  </div>
                  <div className="mt-1 text-sm text-slate-200">{e.title}</div>
                  <div className="mt-1 text-xs leading-relaxed text-slate-400">
                    打开出处，找出描述里一条该页面无法支持的说法，再用第二个来源核对。
                  </div>
                  <a
                    href={e.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-xs text-sky-300 underline"
                  >
                    Source / 出处 ↗
                  </a>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* 3 · 分享链接 + 分组导出 */}
        <div className={card}>
          <h3 className="text-sm font-semibold text-white">3 · Shareable view + grouped CSV / 分享与导出</h3>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={copyShare} className={btn}>
              {copied ? "Copied ✓ / 已复制" : "Copy projector link / 复制投影链接"}
            </button>
            <button type="button" onClick={downloadCsv} disabled={!events.length} className={btn}>
              Download CSV / 导出 CSV
            </button>
          </div>
          <input
            readOnly
            value={shareUrl}
            aria-label="Shareable classroom URL"
            className={`${field} mt-3 w-full font-mono text-xs`}
            onFocus={(e) => e.currentTarget.select()}
          />
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            CSV columns: group, year, title, description, place, sourceUrl, sourceType, eventPage.
            Rows are grouped by category (or source type for supplemental entries). Counts so far:{" "}
            {grouped.length} group{grouped.length === 1 ? "" : "s"} / {events.length} row{events.length === 1 ? "" : "s"}.
          </p>
        </div>

        {/* 4 · 意愿收集（预填公开 Issue，不收集个人信息） */}
        <div className={card}>
          <h3 className="text-sm font-semibold text-white">4 · Tell us what a classroom would pay for / 收集真实意愿</h3>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            This opens a pre-filled <strong>public GitHub issue</strong>. It deliberately asks for no
            email and no student information. Nothing is stored on this site — payment is not enabled.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <label className="text-xs text-slate-400">
              Role / 身份
              <select value={role} onChange={(e) => setRole(e.target.value)} className={`${field} mt-1 w-full`}>
                <option>Teacher / 教师</option>
                <option>Homeschool parent / 在家教育家长</option>
                <option>School / district / 学校或学区</option>
                <option>Museum / 博物馆</option>
                <option>Other / 其他</option>
              </select>
            </label>
            <label className="text-xs text-slate-400">
              Willing to pay / 愿意付
              <select value={price} onChange={(e) => setPrice(e.target.value)} className={`${field} mt-1 w-full`}>
                <option>Free only / 只用免费版</option>
                <option>$29–49 / year, individual</option>
                <option>$199–499 / year, per school</option>
                <option>One-time $4–10</option>
                <option>Depends on the feature / 看功能</option>
              </select>
            </label>
            <label className="text-xs text-slate-400">
              Most wanted / 最想要
              <select value={want} onChange={(e) => setWant(e.target.value)} className={`${field} mt-1 w-full`}>
                <option>Printable source-check worksheet / 可打印的出处核对练习</option>
                <option>Shareable date view / 可分享日期视图</option>
                <option>Grouped CSV export / 分组导出</option>
                <option>Historical borders / 历史国界</option>
                <option>Chinese / Spanish content / 中文或西语内容</option>
              </select>
            </label>
          </div>
          <a
            href={issueUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`${btn} mt-3 inline-block`}
          >
            Open pre-filled issue / 打开预填反馈 ↗
          </a>
        </div>
      </div>
    </section>
  );
}
