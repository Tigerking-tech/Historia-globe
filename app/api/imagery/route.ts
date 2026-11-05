import { NextRequest, NextResponse } from "next/server";

// ============================================================================
// 连续栅格影像代理（同源转发，解决"拼图感"）
// ----------------------------------------------------------------------------
// 背景：自绘 MVT 瓦片（3D 建筑/街道/地面色块）是一块块矩形拼上去的，
//       中高空缩放时瓦片边界、数据截断、空白间隙会形成"拼图"观感。
//       正解是铺一层从 z0 到 z19 连续无缝的栅格影像底图，任何缩放级别
//       都是"满屏同一张图"，3D 建筑只在低空作为点缀叠加。
// 通道：服务端按需转发单张瓦片（不批量抓取、不落盘成自有数据集），
//       浏览器只请求本站域名，规避移动网络直连上游不可达 / CORS 问题。
// 来源：Esri World Imagery（卫星，需署名 © Esri）；
//       Carto dark_all（街道地图，需署名 © OSM / © CARTO）作为可选 style。
// ============================================================================

export const dynamic = "force-dynamic";

const ESRI_TILE =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const CARTO_TILE = "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png";

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const z = Number(p.get("z"));
  const x = Number(p.get("x"));
  const y = Number(p.get("y"));
  const style = p.get("style") === "street" ? "street" : "sat";
  if (
    !Number.isInteger(z) || !Number.isInteger(x) || !Number.isInteger(y) ||
    z < 0 || z > 20 || x < 0 || y < 0 || x >= 2 ** z || y >= 2 ** z
  ) {
    return NextResponse.json({ error: "invalid tile coordinates" }, { status: 400 });
  }

  const url = (style === "street" ? CARTO_TILE : ESRI_TILE)
    .replace("{z}", String(z))
    .replace("{x}", String(x))
    .replace("{y}", String(y));

  try {
    const upstream = await fetch(url, {
      next: { revalidate: 604800 },
      signal: AbortSignal.timeout(12000),
    });
    if (!upstream.ok) {
      return NextResponse.json({ error: "upstream imagery unavailable" }, { status: 502 });
    }
    const buf = await upstream.arrayBuffer();
    if (!buf.byteLength) {
      return NextResponse.json({ error: "empty imagery tile" }, { status: 502 });
    }
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": style === "street" ? "image/png" : "image/jpeg",
        "Cache-Control": "public, max-age=604800, immutable",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: "imagery fetch failed", detail: String((e as Error)?.message || e) },
      { status: 502 }
    );
  }
}
