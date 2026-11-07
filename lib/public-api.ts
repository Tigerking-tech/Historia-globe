// 公开只读 API 的数据层：REST 与 MCP 端点共用同一套查询与口径，
// 保证「同一个日期」在两种调用方式下返回一致的结果。
//
// 诚实边界：只读本地静态层，不发起任何外部网络请求、不读数据库、
// 不暴露用户数据。补充条目没有坐标，原样标注 hasCoordinates=false，
// 绝不凭空补经纬度或大洲。

import { NextResponse } from "next/server";
import {
  CONTENT_EVENTS,
  getEventContent,
  getDateContent,
  getSupplementalEvents,
  parseDateSlug,
  dateLabel,
  allPlaceSlugs,
  getPlaceContent,
  type ContentEvent,
} from "./content";
import { coverageStats, FACT_SLUGS, FACT_INDEX_PATH } from "./facts";

export const API_VERSION = "v1";
export const API_BASE = `/api/public/${API_VERSION}`;
export const MCP_ENDPOINT = "/api/public/mcp";

export const LICENSE_NOTE =
  "Free to read, no account or API key. Curated event records are hand-checked and link to a Wikipedia search page (not a single primary source); supplemental entries link to their real en.wikipedia.org URL. Reuse subject to upstream licences; retain attribution. This API makes no claim that the record is complete or regionally balanced.";

/** 公开事件形状：字段名稳定，供 AI 助手直接引用。 */
export function toPublicEvent(e: ContentEvent) {
  return {
    title: e.title,
    year: e.year,
    date: `${String(e.m).padStart(2, "0")}-${String(e.d).padStart(2, "0")}`,
    place: e.place,
    category: e.category,
    coordinates: { lat: e.lat, lon: e.lon },
    description: e.description,
    sourceUrl: e.sourceUrl,
    sourceType: "wikipedia-search-page",
    eventPage: `/event/${e.slug}`,
    datePage: `/on-this-day/${e.dateSlug}`,
  };
}

function toPublicSupplemental(e: {
  m: number; d: number; year: number; title: string; description: string; sourceUrl: string;
}) {
  return {
    title: e.title,
    year: e.year,
    date: `${String(e.m).padStart(2, "0")}-${String(e.d).padStart(2, "0")}`,
    description: e.description,
    sourceUrl: e.sourceUrl,
    sourceType: "wikipedia-on-this-day",
    hasCoordinates: false,
  };
}

export type DateQuery = {
  ok: boolean;
  error?: string;
  date?: string;
  label?: string;
  total?: number;
  curatedCount?: number;
  supplementalCount?: number;
  curated?: ReturnType<typeof toPublicEvent>[];
  supplemental?: ReturnType<typeof toPublicSupplemental>[];
  pages?: { datePage: string; sources: string };
};

export function queryDate(slug: string): DateQuery {
  const parsed = parseDateSlug(slug);
  if (!parsed) {
    return { ok: false, error: "Invalid date. Use MM-DD, e.g. 07-20." };
  }
  const c = getDateContent(slug);
  const curated = (c?.events ?? []).map(toPublicEvent);
  const supplemental = getSupplementalEvents(slug).map(toPublicSupplemental);
  return {
    ok: true,
    date: slug,
    label: dateLabel(parsed.m, parsed.d),
    total: curated.length + supplemental.length,
    curatedCount: curated.length,
    supplementalCount: supplemental.length,
    curated,
    supplemental,
    pages: {
      datePage: `/on-this-day/${slug}`,
      sources: LICENSE_NOTE,
    },
  };
}

export function searchEvents(query: string, limit = 20, category?: string) {
  const q = query.trim().toLowerCase();
  const safeLimit = Math.max(1, Math.min(50, Number(limit) || 20));
  if (!q) return { ok: false as const, error: "Query parameter 'q' is required." };
  const matched = CONTENT_EVENTS.filter((e) => {
    if (category && e.category !== category) return false;
    return (
      e.title.toLowerCase().includes(q) ||
      e.description.toLowerCase().includes(q) ||
      e.place.toLowerCase().includes(q)
    );
  })
    .slice(0, safeLimit)
    .map(toPublicEvent);
  return {
    ok: true as const,
    query,
    category: category ?? null,
    count: matched.length,
    limit: safeLimit,
    events: matched,
    note: "Searches the 150 hand-checked curated events only. The supplemental On-this-day snapshot is available via /on-this-day/{date}.",
  };
}

export function getEventBySlug(slug: string) {
  const e = getEventContent(slug);
  if (!e) return { ok: false as const, error: `No curated event with slug '${slug}'.` };
  return { ok: true as const, event: toPublicEvent(e), sources: LICENSE_NOTE };
}

export function getPlaceBySlug(slug: string) {
  const p = getPlaceContent(slug);
  if (!p) return { ok: false as const, error: `No place with slug '${slug}'.` };
  return {
    ok: true as const,
    place: p.place,
    count: p.events.length,
    events: p.events.map(toPublicEvent),
    sources: LICENSE_NOTE,
  };
}

export function publicCoverage() {
  return { ok: true as const, ...coverageStats(), sources: LICENSE_NOTE };
}

export function apiIndex() {
  const base = "https://historiaglobe.com";
  return {
    ok: true as const,
    name: "Historia Globe public read-only API",
    version: API_VERSION,
    description:
      "Query what happened around the world on a given calendar date. Every result carries a sourceUrl. Free, no key, no account.",
    license: LICENSE_NOTE,
    endpoints: [
      { method: "GET", path: `${API_BASE}/on-this-day/{MM-DD}`, description: "All events for a date, curated + supplemental." },
      { method: "GET", path: `${API_BASE}/events?q={text}&limit=20&category={slug}`, description: "Search curated events." },
      { method: "GET", path: `${API_BASE}/event/{slug}`, description: "One curated event." },
      { method: "GET", path: `${API_BASE}/place/{slug}`, description: "Events grouped by place." },
      { method: "GET", path: `${API_BASE}/coverage`, description: "Exact coverage and category statistics." },
      { method: "POST", path: MCP_ENDPOINT, description: "MCP-style JSON-RPC tools (initialize / tools/list / tools/call)." },
      { method: "GET", path: "/mcp.json", description: "Machine-readable capability manifest." },
      { method: "GET", path: "/llms.txt", description: "Site facts for AI assistants." },
    ],
    factPages: [`${FACT_INDEX_PATH}`, ...FACT_SLUGS.map((s) => `${FACT_INDEX_PATH}/${s}`)],
    sitemap: `${base}/sitemap.xml`,
    limits: "Read-only. No authentication. No write operations. Results come from a build-time static snapshot and change only when the site is rebuilt.",
  };
}

export function listMcpTools() {
  return [
    {
      name: "get_events_on_date",
      description:
        "Return every event recorded for a calendar date (MM-DD), with a sourceUrl for each. Includes geolocated curated events and supplemental Wikipedia On-this-day entries.",
      inputSchema: {
        type: "object",
        properties: { date: { type: "string", description: "Month-day, e.g. 07-20 or 12-25" } },
        required: ["date"],
      },
    },
    {
      name: "search_events",
      description: "Search the hand-checked curated event archive by title, description or place.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search text" },
          limit: { type: "number", description: "Max results, 1-50 (default 20)" },
          category: { type: "string", description: "Optional category filter, e.g. space" },
        },
        required: ["query"],
      },
    },
    {
      name: "get_event",
      description: "Fetch one curated event by its slug, including coordinates and source URL.",
      inputSchema: {
        type: "object",
        properties: { slug: { type: "string" } },
        required: ["slug"],
      },
    },
    {
      name: "get_coverage_stats",
      description:
        "Return exact, build-time coverage statistics: curated event count, category distribution, distinct places, year ranges, and the supplemental snapshot size. States explicitly what cannot be measured.",
      inputSchema: { type: "object", properties: {} },
    },
  ];
}

export function callMcpTool(name: string, args: Record<string, unknown>) {
  switch (name) {
    case "get_events_on_date":
      return queryDate(String(args?.date ?? ""));
    case "search_events":
      return searchEvents(String(args?.query ?? ""), Number(args?.limit ?? 20), args?.category ? String(args.category) : undefined);
    case "get_event":
      return getEventBySlug(String(args?.slug ?? ""));
    case "get_coverage_stats":
      return publicCoverage();
    default:
      return { ok: false, error: `Unknown tool '${name}'. Use tools/list to see available tools.` };
  }
}

/** 统一 CORS 与缓存头：公开只读接口允许任何来源调用。 */
export function publicJson(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export function publicOptions() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
