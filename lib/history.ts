// Server-side history data layer.
// Fuses four live/authoritative sources plus a curated fallback:
//   - curated geolocated events (reliable, always available, pin-on-globe)
//   - Wikipedia "on this day" (auto-geocoded when coordinates exist)
//   - Wikidata SPARQL (structured, sourced, natively geolocated; ALSO the source of
//     terrorism events because it is CC0 / free for commercial use)
//   - domain databases UCDP (war) and EM-DAT (disaster), registration-gated CSVs
//   - UNESCO World Heritage sites (authoritative, geolocated)
// Terrorism events are deliberately NOT taken from GTD (its EULA is non-commercial).
import { SEED_EVENTS } from "./seed-events";
import config from "@/config";
import { loadDomainEventsForDate } from "./domain-sources";

export type HistoryEvent = {
  id: string;
  year: number;
  title: string;
  description: string;
  lat: number | null;
  lon: number | null;
  place: string;
  category: string;
  source: "curated" | "wikipedia" | "wikidata" | "domain";
  wiki?: string;
};

export type HeritageSite = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  country: string;
  category: string;
  year: number | null;
  image: string | null;
  description: string;
};

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function formatYear(year: number): string {
  return year < 0 ? `${-year} BCE` : `${year}`;
}

// Fetch with a hard timeout so an unreachable upstream (Wikipedia / UNESCO / LLM)
// fails fast instead of hanging the request forever in restricted environments.
export async function fetchWithTimeout(
  url: string,
  options: any = {},
  timeoutMs = 6000
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal } as any);
  } finally {
    clearTimeout(id);
  }
}

export function countryOf(place: string): string {
  if (!place) return "";
  const parts = place.split(",").map((s) => s.trim());
  return parts[parts.length - 1] || "";
}

const DAY_CACHE = new Map<string, { ts: number; events: HistoryEvent[] }>();
let HERITAGE_CACHE: { ts: number; sites: HeritageSite[] } | null = null;
const TTL = 1000 * 60 * 60 * 24; // 24h

// ---- Curated (always available, geolocated) ----
function curatedForDate(m: number, d: number): HistoryEvent[] {
  return SEED_EVENTS.filter((e) => e.m === m && e.d === d).map((e, i) => ({
    id: `curated-${m}-${d}-${i}`,
    year: e.year,
    title: e.title,
    description: e.description,
    lat: e.lat,
    lon: e.lon,
    place: e.place,
    category: e.category,
    source: "curated" as const,
  }));
}

export function getShowcaseEvents(): HistoryEvent[] {
  // A spread of famous, geolocated events for the hero globe.
  const picks = [1, 7, 14, 20, 28, 37, 47, 55, 67, 74, 85, 92, 101, 110, 113];
  return picks.map((i) => {
    const e = SEED_EVENTS[i];
    return {
      id: `showcase-${i}`,
      year: e.year, title: e.title, description: e.description,
      lat: e.lat, lon: e.lon, place: e.place, category: e.category, source: "curated" as const,
    };
  });
}

// ---- Wikipedia "on this day" + batch geocoding ----
async function fetchWikipedia(m: number, d: number): Promise<HistoryEvent[]> {
  try {
    const pad = (n: number) => String(n).padStart(2, "0");
    const res = await fetchWithTimeout(
      `https://en.wikipedia.org/api/rest_v1/feed/onthisday/events/${pad(m)}/${pad(d)}`,
      { headers: { "User-Agent": "HistoriaGlobe/1.0 (https://historiaglobe.com)" }, next: { revalidate: TTL } } as any,
      2500
    );
    if (!res.ok) return [];
    const data = await res.json();
    const raw = (data.events || []).slice(0, 30).map((e: any, i: number) => ({
      id: `wiki-${m}-${d}-${i}`,
      year: e.year,
      title: e.pages?.[0]?.title || e.text.slice(0, 60),
      description: e.text,
      lat: null,
      lon: null,
      place: "",
      category: "history",
      source: "wikipedia" as const,
      wiki: e.pages?.[0]?.title,
    }));
    return await geocodeWikipedia(raw);
  } catch {
    return [];
  }
}

async function geocodeWikipedia(events: HistoryEvent[]): Promise<HistoryEvent[]> {
  const titles = events.map((e) => e.wiki).filter(Boolean) as string[];
  if (!titles.length) return events;
  try {
    const coordMap = await batchCoordinates(titles);
    return events.map((e) => {
      const c = e.wiki ? coordMap[e.wiki] : null;
      if (c) return { ...e, lat: c.lat, lon: c.lon, place: e.place || c.country || "" };
      return e;
    });
  } catch {
    return events;
  }
}

async function batchCoordinates(titles: string[]): Promise<Record<string, { lat: number; lon: number; country: string }>> {
  const map: Record<string, { lat: number; lon: number; country: string }> = {};
  const chunks: string[][] = [];
  for (let i = 0; i < titles.length; i += 20) chunks.push(titles.slice(i, i + 20));
  for (const chunk of chunks) {
    const url =
      "https://en.wikipedia.org/w/api.php?action=query&prop=coordinates&format=json&titles=" +
      chunk.map(encodeURIComponent).join("|");
    try {
      const r = await fetchWithTimeout(url, {
        headers: { "User-Agent": "HistoriaGlobe/1.0" }, next: { revalidate: TTL },
      } as any);
      if (!r.ok) continue;
    const d = await r.json();
    const pages = d.query?.pages || {};
    for (const k of Object.keys(pages)) {
      const p = pages[k];
      const c = p.coordinates?.[0];
      if (c) map[p.title] = { lat: c.lat, lon: c.lon, country: "" };
    }
    } catch {
      // skip chunk
    }
  }
  return map;
}

// ---- Wikidata (structured, sourced, geolocated) — alternative to Wikipedia prose ----
// Uses the Wikidata Query Service (SPARQL). Every claim can carry a reference, so it
// is more traceable than Wikipedia "on this day". Falls back to [] if unreachable
// (e.g. in restricted networks) so the page never breaks.
const WIKIDATA_SPARQL = "https://query.wikidata.org/sparql";

async function fetchWikidataEvents(m: number, d: number): Promise<HistoryEvent[]> {
  // Events (Q1190554 and subclasses) that happened on this month/day and have a coordinate.
  // Terrorist attacks (Q45572 and subclasses) are flagged so they render as the
  // "terrorism" category — this is our commercial-safe source for such events (CC0).
  const sparql = `
    SELECT ?event ?eventLabel ?date ?coord ?placeLabel ?countryLabel WHERE {
      ?event wdt:P31/wdt:P279* wd:Q1190554 .
      { ?event wdt:P585 ?date. } UNION { ?event wdt:P580 ?date. }
      FILTER(MONTH(?date) = ${m} && DAY(?date) = ${d})
      ?event wdt:P625 ?coord .
      OPTIONAL { ?event wdt:P276 ?place. }
      OPTIONAL { ?event wdt:P17 ?country. }
      OPTIONAL { ?event wdt:P31/wdt:P279* wd:Q45572. BIND(true AS ?isTerror) }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }
    }
    LIMIT 60`;
  try {
    const res = await fetchWithTimeout(
      `${WIKIDATA_SPARQL}?query=${encodeURIComponent(sparql)}&format=json`,
      {
        headers: {
          "User-Agent": "HistoriaGlobe/1.0 (https://historiaglobe.com)",
          Accept: "application/sparql-results+json",
        },
        next: { revalidate: TTL },
      } as any,
      6000
    );
    if (!res.ok) return [];
    const data = await res.json();
    const out: HistoryEvent[] = [];
    for (const row of data.results?.bindings || []) {
      const coord = row.coord?.value || "";
      const cm = coord.match(/Point\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/);
      if (!cm) continue;
      const lon = parseFloat(cm[1]);
      const lat = parseFloat(cm[2]);
      const label = row.eventLabel?.value || "";
      const qid = (row.event?.value || "").split("/").pop() || "";
      const country = row.countryLabel?.value || "";
      const placeName = row.placeLabel?.value || "";
      out.push({
        id: `wikidata-${qid}`,
        year: parseYear(row.date?.value || ""),
        title: label,
        description: label,
        lat,
        lon,
        place: country || placeName,
        category: row.isTerror ? "terrorism" : "history",
        source: "wikidata" as const,
        wiki: qid,
      });
    }
    return out;
  } catch {
    return [];
  }
}

// Pull the year out of a Wikidata xsd:dateTime / date string ("+1969-07-20T00:00:00Z").
function parseYear(s: string): number {
  const m = s.match(/(-?\d{1,4})/);
  return m ? parseInt(m[1], 10) : 0;
}

// ---- Merge for a date ----
export async function getEventsForDate(m: number, d: number): Promise<HistoryEvent[]> {
  const key = `${m}-${d}`;
  const cached = DAY_CACHE.get(key);
  if (cached && Date.now() - cached.ts < TTL) return cached.events;

  const curated = curatedForDate(m, d);
  const [wiki, wd, domain] = await Promise.all([
    fetchWikipedia(m, d),
    fetchWikidataEvents(m, d),
    loadDomainEventsForDate({ m, d }),
  ]);
  // Merge with dedupe by normalized title. Order is wiki → wikidata → domain, so on a
  // title collision the earlier (coordinate-bearing, traceable) source wins. Wikidata is
  // also the authoritative source for terrorism events (CC0), so it takes priority there.
  const byTitle = new Map<string, HistoryEvent>();
  const keyOf = (t: string) => t.toLowerCase().trim();
  for (const e of [...wiki, ...wd, ...domain]) {
    const k = keyOf(e.title);
    const existing = byTitle.get(k);
    if (!existing || (existing.lat == null && e.lat != null)) byTitle.set(k, e);
  }
  const seen = new Set(curated.map((e) => keyOf(e.title)));
  const merged: HistoryEvent[] = [...curated];
  for (const e of Array.from(byTitle.values())) {
    if (!seen.has(keyOf(e.title))) {
      seen.add(keyOf(e.title));
      merged.push(e);
    }
  }
  merged.sort((a, b) => b.year - a.year);
  DAY_CACHE.set(key, { ts: Date.now(), events: merged });
  return merged;
}

// ---- UNESCO World Heritage (authoritative, geolocated) ----
const SEED_HERITAGE: HeritageSite[] = [
  { id: "seed-1", name: "Great Wall", lat: 40.43, lon: 116.57, country: "China", category: "Cultural", year: 1987, image: null, description: "A series of fortifications built across centuries to protect Chinese states." },
  { id: "seed-2", name: "Taj Mahal", lat: 27.18, lon: 78.04, country: "India", category: "Cultural", year: 1983, image: null, description: "An ivory-white marble mausoleum in Agra." },
  { id: "seed-3", name: "Pyramids of Giza", lat: 29.98, lon: 31.13, country: "Egypt", category: "Cultural", year: 1979, image: null, description: "The only surviving wonder of the ancient world." },
  { id: "seed-4", name: "Machu Picchu", lat: -13.16, lon: -72.55, country: "Peru", category: "Cultural", year: 1983, image: null, description: "An Incan citadel set high in the Andes." },
  { id: "seed-5", name: "Colosseum", lat: 41.89, lon: 12.49, country: "Italy", category: "Cultural", year: 1980, image: null, description: "An iconic Roman amphitheatre." },
  { id: "seed-6", name: "Statue of Liberty", lat: 40.69, lon: -74.05, country: "USA", category: "Cultural", year: 1984, image: null, description: "A neoclassical sculpture on Liberty Island." },
  { id: "seed-7", name: "Stonehenge", lat: 51.18, lon: -1.83, country: "United Kingdom", category: "Cultural", year: 1986, image: null, description: "A prehistoric stone circle in Wiltshire." },
  { id: "seed-8", name: "Petra", lat: 30.33, lon: 35.44, country: "Jordan", category: "Cultural", year: 1985, image: null, description: "A city carved into rose-red sandstone cliffs." },
];

export async function getHeritageSites(): Promise<HeritageSite[]> {
  if (HERITAGE_CACHE && Date.now() - HERITAGE_CACHE.ts < TTL) return HERITAGE_CACHE.sites;
  const SELECT =
    "name_en,date_inscribed,geo_point_2d,states_names,category,main_image_url,short_description_en,id_no";
  const base = `${config.unesco.baseUrl}/${config.unesco.dataset}/records`;
  try {
    const first = await fetchHeritagePage(base, SELECT, 0, 100);
    const total = first.total || 0;
    const offsets: number[] = [];
    for (let off = 100; off < total; off += 100) offsets.push(off);
    const rest = await Promise.all(
      offsets.map((off) => fetchHeritagePage(base, SELECT, off, 100))
    );
    const sites = [first.sites, ...rest.map((p) => p.sites)].flat();
    HERITAGE_CACHE = { ts: Date.now(), sites };
    return sites;
  } catch {
    return SEED_HERITAGE;
  }
}

async function fetchHeritagePage(
  base: string,
  select: string,
  offset: number,
  limit: number
): Promise<{ total: number; sites: HeritageSite[] }> {
  const url = `${base}?limit=${limit}&offset=${offset}&select=${encodeURIComponent(select)}`;
  const r = await fetchWithTimeout(url, { headers: { "User-Agent": "HistoriaGlobe/1.0" } } as any, 4000);
  if (!r.ok) throw new Error(`unesco ${r.status}`);
  const data = await r.json();
  const sites: HeritageSite[] = (data.results || [])
    .filter((x: any) => x.geo_point_2d && x.geo_point_2d.lat && x.geo_point_2d.lon)
    .map((x: any, i: number) => ({
      id: `unesco-${x.id_no || i}`,
      name: x.name_en,
      lat: x.geo_point_2d.lat,
      lon: x.geo_point_2d.lon,
      country: (x.states_names && x.states_names[0]) || "",
      category: x.category || "Cultural",
      year: x.date_inscribed ? parseInt(x.date_inscribed, 10) : null,
      image: x.main_image_url || null,
      description: (x.short_description_en || "").slice(0, 240),
    }));
  return { total: data.total_count || 0, sites };
}

// ---- AI context builder: weave the day's global events together ----
export function buildDayContext(
  m: number,
  d: number,
  events: HistoryEvent[],
  heritage: HeritageSite[]
): string {
  const dateLabel = `${MONTHS[m - 1]} ${d}`;
  const placed = events.filter((e) => e.lat != null);
  const lines = placed.map(
    (e) =>
      `- ${formatYear(e.year)}: ${e.title} — ${e.place || "an unlocated place"}. ${e.description}`
  );
  const countries = new Set(placed.map((e) => countryOf(e.place)).filter(Boolean));
  const near = heritage.filter((h) => countries.has(h.country)).slice(0, 8);
  const nearLines = near.map(
    (h) =>
      `- ${h.name} (${h.country}${h.year ? `, inscribed ${h.year}` : ""}) is a UNESCO World Heritage Site.`
  );
  return [
    `Date in focus: ${dateLabel}.`,
    "",
    "Historical events recorded around the world on this day (with coordinates):",
    lines.join("\n") || "- (no geolocated events curated for this date yet)",
    "",
    "Relevant UNESCO World Heritage context (same regions as the events above):",
    nearLines.join("\n") || "- (none)",
  ].join("\n");
}
