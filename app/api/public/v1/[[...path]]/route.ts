// 公开只读 REST API（v1）。
// 单一 catch-all 路由按 path 分派，避免多个文件重复 CORS / 缓存逻辑。
// 只读静态数据层，不访问数据库、不发起外部请求、不写任何状态。

import { NextRequest } from "next/server";
import {
  apiIndex,
  queryDate,
  searchEvents,
  getEventBySlug,
  getPlaceBySlug,
  publicCoverage,
  publicJson,
  publicOptions,
} from "@/lib/public-api";

export const runtime = "nodejs";
// events?q= 需要读取 searchParams，不能用 force-static；
// 缓存交给响应头的 s-maxage（CDN 层），数据本身是构建期静态快照。
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return publicOptions();
}

export async function GET(req: NextRequest, { params }: { params: { path?: string[] } }) {
  const seg = params.path ?? [];

  // /api/public/v1 或 /api/public/v1/ —— 能力与端点清单
  if (seg.length === 0) return publicJson(apiIndex());

  const [head, value] = seg;

  switch (head) {
    case "on-this-day":
      if (!value) return publicJson({ ok: false, error: "Missing date. Use /on-this-day/{MM-DD}." }, 400);
      return publicJson(queryDate(value));

    case "events": {
      const q = req.nextUrl.searchParams.get("q") ?? "";
      const limit = req.nextUrl.searchParams.get("limit") ?? "20";
      const category = req.nextUrl.searchParams.get("category") ?? undefined;
      return publicJson(searchEvents(q, Number(limit), category));
    }

    case "event":
      if (!value) return publicJson({ ok: false, error: "Missing event slug." }, 400);
      return publicJson(getEventBySlug(value));

    case "place":
      if (!value) return publicJson({ ok: false, error: "Missing place slug." }, 400);
      return publicJson(getPlaceBySlug(value));

    case "coverage":
      return publicJson(publicCoverage());

    default:
      return publicJson(
        { ok: false, error: `Unknown endpoint '${head}'. See ${"/api/public/v1"} for the endpoint list.` },
        404
      );
  }
}
