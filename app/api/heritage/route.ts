import { NextResponse } from "next/server";
import { getHeritageSites } from "@/lib/history";

// Fetch live from UNESCO at request time (the data layer keeps a 24h in-memory
// TTL, so we don't hammer the API). Avoid build-time static prerender so the
// globe always gets the full World Heritage list, not the offline seed fallback.
export const dynamic = "force-dynamic";

export async function GET() {
  const sites = await getHeritageSites();
  return NextResponse.json({ sites });
}
