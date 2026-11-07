// 事件上报入口：漏斗埋点 + 爬虫命中（由 middleware 转发）。
import { NextRequest, NextResponse } from "next/server";
import { recordEvent, detectBot, type ObsEvent } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = new Set([
  "page_view", "reel_start", "reel_slide", "checkout_click",
  "export_csv", "teacher_entry", "crawler_hit",
]);

export async function POST(req: NextRequest) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }
  const step = String(body.step || "");
  if (!ALLOWED.has(step)) {
    return NextResponse.json({ ok: false, error: "unknown_step" }, { status: 400 });
  }
  const ua = String(body.ua || req.headers.get("user-agent") || "").slice(0, 400);
  const bot = body.bot ? String(body.bot).slice(0, 60) : detectBot(ua);
  const e: ObsEvent = {
    ts: Date.now(),
    kind: step === "crawler_hit" || !!bot && step === "page_view" ? "crawler" : "human",
    step,
    path: String(body.path || "").slice(0, 300) || undefined,
    ua: ua || undefined,
    bot: bot || undefined,
    lang: String(body.lang || "").slice(0, 8) || undefined,
    ref: String(body.ref || "").slice(0, 200) || undefined,
  };
  recordEvent(e);
  return NextResponse.json({ ok: true, kind: e.kind, bot: bot || null });
}

/** 便于运维/验证用 GET 查看当前统计（只读）。 */
export async function GET(req: NextRequest) {
  const { getStats } = await import("@/lib/observability");
  const win = Number(req.nextUrl.searchParams.get("window") || 60);
  return NextResponse.json(getStats(Number.isFinite(win) ? Math.min(720, Math.max(1, win)) : 60));
}
