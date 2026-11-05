// AskYore 对话层服务端入口（Next.js App Router）。
// 四个 action：
//   capabilities — 列出工具（chat/voice/MCP 三种 surface），供外部 Agent 发现
//   context      — 生成场景上下文 + 防幻觉规则
//   tool         — 通过带花费闸的目录执行一个白名单工具
//   session      — 用主密钥换取短时会话凭证；主密钥永不返回浏览器
//
// 安全约束：固定上游白名单（防 SSRF）、响应大小上限、per-IP 频率限制、
// 无密钥时一律 local 模式且不发起任何外呼。

import { NextRequest, NextResponse } from "next/server";
import { getEventsForDate, getHeritageSites } from "@/lib/history";
import { buildSceneContext, groundingRules } from "@/lib/ask-yore/context";
import { composeCatalog, spendInterceptor } from "@/lib/ask-yore/tools";
import { SpendGuard, estimateUsd } from "@/lib/ask-yore/spend";
import { ToolError } from "@/lib/ask-yore/types";
import type { SceneContext, Surface } from "@/lib/ask-yore/types";
import config from "@/config";

export const maxDuration = 30;

const guard = new SpendGuard();
const rate = new Map<string, { count: number; reset: number }>();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 60;

function clientKey(req: NextRequest) {
  const fwd = req.headers.get("x-forwarded-for") || "";
  return (fwd.split(",")[0] || req.headers.get("x-real-ip") || "local").trim();
}

function rateOk(key: string) {
  const now = Date.now();
  const cur = rate.get(key);
  if (!cur || now > cur.reset) {
    rate.set(key, { count: 1, reset: now + RATE_WINDOW_MS });
    return true;
  }
  if (cur.count >= RATE_MAX) return false;
  cur.count += 1;
  return true;
}

/** 防 SSRF：只允许 https + 明确白名单 host，拒绝私网/回环 */
function safeUpstream(raw: string) {
  const u = new URL(raw);
  if (u.protocol !== "https:") throw new Error("upstream must be https");
  const host = u.hostname.toLowerCase();
  const allow = new Set(["api.openai.com"]);
  if (process.env.LLM_BASE_URL) {
    try {
      allow.add(new URL(process.env.LLM_BASE_URL).hostname.toLowerCase());
    } catch {}
  }
  if (!allow.has(host)) throw new Error("upstream host not allowed");
  if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|::1)/.test(host)) {
    throw new Error("private upstream rejected");
  }
  return u.toString();
}

function defaultScene(): SceneContext {
  const n = new Date();
  return {
    month: n.getMonth() + 1,
    day: n.getDate(),
    lang: "en",
    view: "satellite",
    realEarth: false,
    events: [],
  };
}

function normalizeScene(raw: any): SceneContext {
  const base = defaultScene();
  if (!raw || typeof raw !== "object") return base;
  const num = (v: any, lo: number, hi: number, fb: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= lo && n <= hi ? n : fb;
  };
  return {
    month: num(raw.month, 1, 12, base.month),
    day: num(raw.day, 1, 31, base.day),
    lang: raw.lang === "zh" ? "zh" : "en",
    view: ["satellite", "countries", "night"].includes(raw.view) ? raw.view : base.view,
    realEarth: Boolean(raw.realEarth),
    selectedEventId: typeof raw.selectedEventId === "string" ? raw.selectedEventId.slice(0, 120) : null,
    camera:
      raw.camera && Number.isFinite(Number(raw.camera.lat)) && Number.isFinite(Number(raw.camera.lon))
        ? {
            lat: Math.max(-90, Math.min(90, Number(raw.camera.lat))),
            lon: Math.max(-180, Math.min(180, Number(raw.camera.lon))),
            alt: num(raw.camera.alt, 0, 60_000_000, 28_000_000),
            heading: Number(raw.camera.heading) || 0,
            pitch: Number(raw.camera.pitch) || -90,
          }
        : null,
    events: Array.isArray(raw.events)
      ? raw.events.slice(0, 40).map((e: any) => ({
          id: String(e.id || "").slice(0, 120),
          year: Number(e.year) || 0,
          title: String(e.title || "").slice(0, 240),
          place: String(e.place || "").slice(0, 160),
          category: String(e.category || "").slice(0, 60),
          lat: Number.isFinite(Number(e.lat)) ? Number(e.lat) : null,
          lon: Number.isFinite(Number(e.lon)) ? Number(e.lon) : null,
        }))
      : [],
    tour: raw.tour && typeof raw.tour === "object" ? raw.tour : null,
  };
}

export async function POST(req: NextRequest) {
  const ip = clientKey(req);
  if (!rateOk(ip)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const len = Number(req.headers.get("content-length") || 0);
  if (len > 24_000) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "capabilities");
  const surface: Surface = ["chat", "voice", "mcp"].includes(body.surface) ? body.surface : "chat";
  const scene = normalizeScene(body.scene);

  const services = {
    getEvents: (m: number, d: number) => getEventsForDate(m, d),
    getHeritage: () => getHeritageSites(),
    now: () => Date.now(),
  };
  const sessionKey = String(body.sessionId || ip).slice(0, 80);
  const model = config.llm.model || "gpt-4o-mini";
  const catalog = composeCatalog({
    services,
    surface,
    interceptors: [
      spendInterceptor(
        (est) => guard.check(sessionKey, ip, est),
        (usd) => guard.record(sessionKey, ip, usd),
        estimateUsd(model, 800, 200)
      ),
    ],
  });

  try {
    if (action === "capabilities") {
      return NextResponse.json({
        service: "AskYore",
        version: 1,
        surface,
        tools: catalog.mcpTools(),
        functionTools: catalog.functionTools(),
        spend: guard.state(sessionKey),
      });
    }

    if (action === "context") {
      return NextResponse.json({
        surface,
        context: buildSceneContext(scene),
        rules: groundingRules(scene.lang),
      });
    }

    if (action === "tool") {
      const name = String(body.name || "");
      const args = body.args && typeof body.args === "object" ? body.args : {};
      const result = await catalog.run(name, args, scene);
      return NextResponse.json({ ok: true, result, spend: guard.state(sessionKey) });
    }

    if (action === "session") {
      // 未配置任何密钥时一律走 local：前端继续使用 /api/ask 的本地串联降级，
      // 服务端不向任何第三方发起请求。
      const apiKey = process.env.ASKYORE_REALTIME_KEY || config.llm.apiKey;
      if (!apiKey) {
        return NextResponse.json({ mode: "local", reason: "no_voice_key_configured" });
      }
      const tokenUrl = safeUpstream(
        process.env.ASKYORE_REALTIME_TOKEN_URL ||
          `${config.llm.baseUrl.replace(/\/$/, "")}/realtime/client_secrets`
      );
      const resp = await fetch(tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ session: { type: "realtime", model } }),
        signal: AbortSignal.timeout(8000),
      });
      const text = await resp.text();
      if (!resp.ok || text.length > 32_000) {
        return NextResponse.json({ mode: "local", reason: "token_endpoint_unavailable" });
      }
      const data = JSON.parse(text || "{}");
      const secret = data.value || data.client_secret || data.secret;
      if (!secret || typeof secret !== "string") {
        return NextResponse.json({ mode: "local", reason: "no_client_secret" });
      }
      // 只回传短时凭证，主密钥不出服务端。
      return NextResponse.json({
        mode: "realtime",
        clientSecret: secret,
        expiresAt: data.expires_at || null,
        model,
        limits: { warnUsd: 2, hardCapUsd: 5 },
      });
    }

    return NextResponse.json({ error: "unknown_action" }, { status: 400 });
  } catch (e: any) {
    if (e instanceof ToolError) {
      const status = e.code === "unknown_tool" ? 404 : e.code === "budget_exceeded" ? 402 : 400;
      return NextResponse.json({ ok: false, error: e.code, message: e.message }, { status });
    }
    return NextResponse.json({ ok: false, error: "internal", message: String(e?.message || e) }, { status: 500 });
  }
}
