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
import { getSiteOrigin } from "./site-url";
import {
  boundaryStats,
  getBoundaryLayers,
  nearestBoundaryYear,
  sliderYears,
  BOUNDARY_DATASET,
  BOUNDARY_STATUS,
  MODERN_LAYER,
  PANEL_YEARS_IN_SOURCE,
} from "./historical-boundaries";

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

/**
 * 历史边界图层查询（REST 与 MCP 共用）。
 * 只返回真实存在的面板年，不插值；每个图层带数据集级出处与逐要素维基链接占比。
 */
export function queryBoundaries(year?: number) {
  const s = boundaryStats();
  const layers = getBoundaryLayers();
  const base = {
    ok: true as const,
    status: BOUNDARY_STATUS,
    dataset: {
      id: BOUNDARY_DATASET.id,
      name: BOUNDARY_DATASET.name,
      licence: BOUNDARY_DATASET.licence,
      licenceUrl: BOUNDARY_DATASET.licenceUrl,
      sourceUrl: BOUNDARY_DATASET.sourceUrl,
      repository: BOUNDARY_DATASET.repository,
      doi: BOUNDARY_DATASET.doi,
      citation: BOUNDARY_DATASET.citation,
      coverage: BOUNDARY_DATASET.coverage,
      accuracyNote: BOUNDARY_DATASET.accuracyNote,
      modifications: BOUNDARY_DATASET.modifications,
    },
    modern: MODERN_LAYER,
    layers: layers.length,
    totalPolities: s.totalPolities,
    withWikipedia: s.withWikipedia,
    wikiCoveragePercent: s.wikiCoverage,
    panelYearsInSource: PANEL_YEARS_IN_SOURCE,
    bundledYears: layers.map((l) => l.year),
    sliderYears: sliderYears(),
    layerFiles: layers.map((l) => ({ year: l.year, file: l.file, polityCount: l.polityCount, withWikipedia: l.withWikipedia })),
    note:
      "Only real panel years from the source are offered; no boundary is invented or interpolated. Boundaries are scholarly approximations of polity extent, not precise legal borders. Wikipedia links are secondary, not primary sources. Coverage ends at 1497 (last reviewed year in Aligned Cliopatria v1.1). The GPL-3.0 historical-basemaps dataset is deliberately not bundled.",
    factPage: "/facts/historical-boundaries-and-licences",
    interactive: "/historical-boundaries",
  };
  if (typeof year === "number" && Number.isFinite(year)) {
    const snapped = nearestBoundaryYear(year);
    return {
      ...base,
      query: {
        requestedYear: year,
        snappedTo: snapped.year,
        exactPanelYear: snapped.exact,
        layer: snapped.layer,
        file: snapped.layer?.file ?? String(MODERN_LAYER.file),
      },
    };
  }
  return base;
}

export function apiIndex() {
  const base = getSiteOrigin();
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
      { method: "GET", path: `${API_BASE}/boundaries`, description: "Historical border layers: real panel years, licences, per-polity source links and accuracy limits." },
      { method: "GET", path: `${API_BASE}/boundaries/{year}`, description: "Snap a year to the nearest real historical boundary layer (no interpolation). E.g. -44, 1210, 1497." },
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
    {
      name: "get_historical_boundaries",
      description:
        "List real historical border layers by year (CC BY 4.0 Cliopatria data) with dataset licence, academic citation, per-polity Wikipedia source links and accuracy limits. Pass a year to snap to the nearest real panel year. Never interpolates or invents borders; coverage ends at 1497.",
      inputSchema: {
        type: "object",
        properties: { year: { type: "number", description: "Optional year, e.g. -44, 1210, 1497" } },
      },
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
    case "get_historical_boundaries": {
      const raw = args?.year;
      if (raw === undefined || raw === null || raw === "") return queryBoundaries();
      const y = Number(raw);
      if (!Number.isFinite(y)) return { ok: false, error: "year must be a number, e.g. -44 or 1210." };
      return queryBoundaries(y);
    }
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
