import { NextRequest, NextResponse } from "next/server";
import { buildManifest, emptyFallback } from "@/lib/reel/manifest";
import { probeSources } from "@/lib/reel/sources";
import type { ReelEventInput } from "@/lib/reel/types";

/** 「回到那一刻」统一照片幻灯片接口
 *
 * 全站只有一种形态：真实照片幻灯片。返回一份照片清单 JSON（不生成/存储任何视频）。
 * GET /api/reel?q=911                         → 9/11 公有领域史料照片，幻灯片轮换
 * GET /api/reel?q=10.1                        → 该组 PD-China 素材因 URAA 风险已排除，返回专用诚实占位
 * GET /api/reel?title=Apollo 11&year=1969...  → 任意事件按需检索 Commons 自由授权照片
 * GET /api/reel?debug=1                       → 探测图源可达性（部署 Vercel 后自检）
 *
 * 素材只来自 Wikimedia Commons 的 PD / CC0 / CC BY / CC BY-SA（逐条解析许可并署名），
 * 或本地已核验的 9·11 公有领域缓存。来源国「已过期」型 PD（如 PD-China）因美国
 * URAA 版权恢复风险一律排除，见 docs/REEL-COMMONS-CREDITS.md。项目内不再包含任何
 * 需要另行取得商用授权、或在美国版权状态存疑的素材。
 * 沙箱网络不可达时接口照常 200 并返回 mode:"empty" 的诚实占位；部署到 Vercel
 * （境外直连）后自动命中真实照片，无需改代码、无需重新构建。
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 清单很小且完全由事件参数决定 → 交给 CDN 长期缓存，避免重复打上游 */
const CACHE_HEADER = "public, s-maxage=86400, stale-while-revalidate=604800";

function str(p: URLSearchParams, key: string, max = 160): string {
  return (p.get(key) || "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
}
function num(p: URLSearchParams, key: string): number | undefined {
  // 注意：Number(null) === 0，参数缺失时必须先判空，
  // 否则会把「未提供坐标」误当成 0°N / 0°E，违背诚实标注。
  const v = p.get(key);
  if (v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** HTTP 响应头只接受 ByteString（Latin-1）：值里一旦出现中文等非 ASCII 字符，
 *  NextResponse 会抛 "Cannot convert argument to a ByteString" 并让整个请求失败。
 *  这里做最后一道兜底，保证任何事件（含中文检索词）都不会因响应头而降级成 empty。*/
function headerValue(v: string): string {
  return /^[\x20-\x7e]*$/.test(v) ? v : encodeURIComponent(v).slice(0, 120);
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;

  if (p.get("debug") === "1") {
    const sources = await probeSources();
    return NextResponse.json(
      { debug: true, sources, hint: "sandbox network may block these; Vercel direct egress resolves it" },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const q = str(p, "q");
  const title = str(p, "title") || q;
  if (!q && !title) {
    return NextResponse.json({ error: "q or title is required" }, { status: 400 });
  }

  const input: ReelEventInput = {
    q,
    eventId: str(p, "id", 80),
    title,
    year: num(p, "year"),
    place: str(p, "place"),
    category: str(p, "category", 40),
    lat: num(p, "lat") ?? null,
    lon: num(p, "lon") ?? null,
    lang: p.get("lang") === "en" ? "en" : "zh",
    month: num(p, "m"),
    day: num(p, "d"),
  };

  try {
    const manifest = await buildManifest(input);
    return NextResponse.json(manifest, {
      headers: {
        "Cache-Control": CACHE_HEADER,
        "X-Reel-Mode": headerValue(manifest.mode),
        "X-Reel-Key": headerValue(manifest.key),
      },
    });
  } catch (e) {
    // 任何上游异常都不应该让页面打不开：不打网络，直接返回同一套空幻灯片结构
    console.error("[reel] buildManifest failed:", { q, title }, (e as Error)?.stack || e);
    const fallback = emptyFallback(input, (e as Error).message);
    return NextResponse.json(fallback, { headers: { "Cache-Control": "no-store" } });
  }
}
