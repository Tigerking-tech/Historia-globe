import { NextRequest, NextResponse } from "next/server";
import { buildManifest, schematicFallback } from "@/lib/reel/manifest";
import { probeSources } from "@/lib/reel/sources";
import type { ReelEventInput } from "@/lib/reel/types";

/** 「回到那一刻」通用影像接口
 *
 * GET /api/reel?q=10.1
 * GET /api/reel?title=Apollo%2011&year=1969&place=Houston&lat=29.55&lon=-95.1&lang=zh
 * GET /api/reel?debug=1        探测各免费图源可达性（部署 Vercel 后自检用）
 * GET /api/reel?fixture=1&...  离线演示数据（自绘 SVG），仅用于验证播放器链路
 * GET /api/reel?commons=1&...  维基共享资源真实史料照片（1949 相关事件），许可逐张核验
 *
 * 返回的是**时间轴描述 JSON**，不是视频，也不生成/存储视频。
 * 沙箱内 Wikimedia / archive.org 不可达时，接口照常 200 并返回 schematic，
 * 前端仍能完整播放 10 秒；部署到 Vercel（境外网络直连）后自动变成真实素材，
 * 无需改任何代码、无需重新构建。
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** manifest 很小且完全由事件参数决定 → 交给 CDN 长期缓存，避免重复打上游 */
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
    const manifest = await buildManifest(input, {
      fixture: p.get("fixture") === "1",
      commons: p.get("commons") === "1",
    });
    return NextResponse.json(manifest, {
      headers: {
        "Cache-Control": CACHE_HEADER,
        "X-Reel-Mode": manifest.mode,
        "X-Reel-Key": manifest.key,
      },
    });
  } catch (e) {
    // 任何上游异常都不应该让页面播不了：不打网络，直接退回 schematic 时间轴
    const fallback = schematicFallback(input, (e as Error).message);
    return NextResponse.json(fallback, { headers: { "Cache-Control": "no-store" } });
  }
}
