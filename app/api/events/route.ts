import { NextRequest, NextResponse } from "next/server";
import { getEventsForDate } from "@/lib/history";

export const revalidate = 86400;

export async function GET(req: NextRequest) {
  const m = parseInt(req.nextUrl.searchParams.get("month") || "0", 10);
  const d = parseInt(req.nextUrl.searchParams.get("day") || "0", 10);
  if (!m || !d) {
    return NextResponse.json({ error: "month and day are required" }, { status: 400 });
  }
  const events = await getEventsForDate(m, d);
  return NextResponse.json({ month: m, day: d, events });
}
