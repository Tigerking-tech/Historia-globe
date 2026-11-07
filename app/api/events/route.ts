import { NextRequest, NextResponse } from "next/server";
import { getEventsForDateDetailed } from "@/lib/history";

export const revalidate = 86400;

export async function GET(req: NextRequest) {
  const m = parseInt(req.nextUrl.searchParams.get("month") || "0", 10);
  const d = parseInt(req.nextUrl.searchParams.get("day") || "0", 10);
  if (!m || !d) {
    return NextResponse.json({ error: "month and day are required" }, { status: 400 });
  }
  // 连同数据源状态一起返回：外部实时源不可达时，前端会诚实告知用户
  // 「当前只有本地策展数据」，而不是把稀疏结果伪装成完整的一天。
  const { events, sources } = await getEventsForDateDetailed(m, d);
  return NextResponse.json({ month: m, day: d, events, sources });
}
