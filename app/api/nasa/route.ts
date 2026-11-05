import { NextRequest, NextResponse } from "next/server";
import { fetchNasaApod } from "@/lib/domain-sources";

export const revalidate = 86400;

// NASA Astronomy Picture of the Day for a given date — free, no key needed (DEMO_KEY).
// Used as an authoritative space-image enrichment for the selected day.
export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date") || "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  }
  const apod = await fetchNasaApod(date);
  if (!apod) {
    return NextResponse.json({ date, apod: null }, { status: 200 });
  }
  return NextResponse.json({ date, apod }, { status: 200 });
}
