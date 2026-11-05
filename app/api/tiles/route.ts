import { NextRequest, NextResponse } from "next/server";

// ============================================================================
// OpenFreeMap 矢量瓦片代理（同源转发）
// ----------------------------------------------------------------------------
// 为什么需要代理：
//   1) OpenFreeMap 的 TileJSON 返回的 tiles 模板带数据版本戳
//      （.../planet/<stamp>/{z}/{x}/{y}.pbf），不带戳的旧路径会返回 0 字节，
//      因此模板必须由服务端实时解析并缓存，不能前端硬编码。
//   2) 浏览器（尤其移动网络 / 中国大陆）直连 tiles.openfreemap.org 常不可达，
//      而服务端可达。改为同源 /api/tiles 后，手机只请求本站域名即可拿到
//      3D 建筑 / 街道 / 地面数据，彻底避免"放大后一片空白"。
//   3) 瓦片不可变，服务端按 stamp 长期缓存，减少上游请求。
// 合规：OpenFreeMap 明确允许商用；数据来自 OSM（ODbL），此处仅流式转发用于
//       实时渲染（Produced Work），不落盘成自有衍生数据库；署名见页面 footer。
// ============================================================================

export const dynamic = "force-dynamic";

const TILEJSON_URL = "https://tiles.openfreemap.org/planet";
// TileJSON 不可达时的兜底模板（stamp 会随数据更新变化，主路径仍是实时 TileJSON）
const FALLBACK_TEMPLATE =
  "https://tiles.openfreemap.org/planet/20261101_080013_pt/{z}/{x}/{y}.pbf";

let cachedTemplate: string | null = null;
let cachedAt = 0;
let inflight: Promise<string> | null = null;
const TEMPLATE_TTL = 6 * 60 * 60 * 1000; // 6 小时刷新一次版本戳

async function getTemplate(): Promise<string> {
  if (cachedTemplate && Date.now() - cachedAt < TEMPLATE_TTL) return cachedTemplate;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch(TILEJSON_URL, {
        next: { revalidate: 21600 },
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const j = await res.json();
        const tpl = j?.tiles?.[0];
        if (typeof tpl === "string" && tpl.includes("{z}")) {
          cachedTemplate = tpl;
          cachedAt = Date.now();
          return tpl;
        }
      }
    } catch {
      /* 落到兜底模板 */
    }
    return cachedTemplate || FALLBACK_TEMPLATE;
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const z = Number(p.get("z"));
  const x = Number(p.get("x"));
  const y = Number(p.get("y"));
  if (
    !Number.isInteger(z) || !Number.isInteger(x) || !Number.isInteger(y) ||
    z < 0 || z > 20 ||
    x < 0 || y < 0 || x >= 2 ** z || y >= 2 ** z
  ) {
    return NextResponse.json({ error: "invalid tile coordinates" }, { status: 400 });
  }

  try {
    const tpl = await getTemplate();
    const url = tpl
      .replace("{z}", String(z))
      .replace("{x}", String(x))
      .replace("{y}", String(y));
    const upstream = await fetch(url, {
      next: { revalidate: 604800 },
      signal: AbortSignal.timeout(12000),
    });
    if (!upstream.ok) {
      return NextResponse.json({ error: "upstream tile unavailable" }, { status: 502 });
    }
    const buf = await upstream.arrayBuffer();
    if (!buf.byteLength) {
      // 版本戳失效的典型症状：200 但 0 字节。强制刷新模板供下次请求使用。
      cachedTemplate = null;
      cachedAt = 0;
      return NextResponse.json({ error: "empty tile (stale template)" }, { status: 502 });
    }
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.mapbox-vector-tile",
        "Cache-Control": "public, max-age=604800, immutable",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: "tile fetch failed", detail: String((e as Error)?.message || e) },
      { status: 502 }
    );
  }
}
