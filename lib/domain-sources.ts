// Domain-specific authoritative event sources: UCDP (armed conflict) and EM-DAT
// (natural disasters). Each is a registration-gated downloadable dataset (CSV), not a
// live public API. We parse the CSV, filter to the requested month/day, and map to
// geolocated HistoryEvents. NASA is handled separately (APOD) since it has no events API.
//
// NOTE: terrorism events are intentionally NOT sourced from GTD. GTD's EULA restricts
// use to non-commercial research and requires a separate written agreement for any
// commercial product. Instead, terrorism events come from Wikidata (CC0, see
// lib/history.ts fetchWikidataEvents), which is free for commercial use.
//
// Drop-in files (all optional; missing files => that source contributes nothing):
//   data/ucdp-ged.csv    UCDP Georeferenced Event Dataset (GED), any recent version.
//   data/emdat.csv       EM-DAT public table export.
// Column names are matched case-insensitively against a candidate list, so minor schema
// drift between dataset versions is tolerated.
import type { HistoryEvent } from "./history";
import fs from "node:fs";

const DATA_DIR = process.cwd() + "/data";
const DOMAIN_CAP = 40; // keep the globe readable: max pins per source per day

// ---- minimal RFC4180-ish CSV parser (handles quoted fields with commas) ----
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else if (c === "\r") {
        /* skip */
      } else field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function colIndex(header: string[], candidates: string[]): number {
  const lower = header.map((h) => h.trim().toLowerCase());
  for (const c of candidates) {
    const i = lower.indexOf(c.toLowerCase());
    if (i >= 0) return i;
  }
  return -1;
}

function get(row: string[], idx: number): string {
  return idx >= 0 && row[idx] != null ? row[idx].trim() : "";
}
function toInt(s: string): number {
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : 0;
}
function toFloat(s: string): number {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
}
// Reject obviously-missing coordinates (null island / out of range).
function validCoord(lat: number, lon: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180 &&
    !(lat === 0 && lon === 0)
  );
}

function loadCsv(path: string): string[][] | null {
  try {
    if (!fs.existsSync(path)) return null;
    return parseCsv(fs.readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function composeDeaths(base: string, deaths: string): string {
  const n = toInt(deaths);
  if (n > 0) return `${base} Reported fatalities: ${n}.`;
  return base;
}

// ---- UCDP Georeferenced Event Dataset ----
export function parseGed(rows: string[][], m: number, d: number): HistoryEvent[] {
  if (rows.length < 2) return [];
  const header = rows[0];
  const iY = colIndex(header, ["year"]);
  const iMo = colIndex(header, ["month"]);
  const iD = colIndex(header, ["day"]);
  const iLat = colIndex(header, ["latitude"]);
  const iLon = colIndex(header, ["longitude"]);
  const iType = colIndex(header, ["event_type", "event type"]);
  const iCountry = colIndex(header, ["country"]);
  const iDeaths = colIndex(header, ["best", "deaths", "total deaths", "n_killed"]);
  const iId = colIndex(header, ["event_id_cnty", "event_id"]);
  const out: HistoryEvent[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (toInt(get(row, iMo)) !== m || toInt(get(row, iD)) !== d) continue;
    const lat = toFloat(get(row, iLat));
    const lon = toFloat(get(row, iLon));
    if (!validCoord(lat, lon)) continue;
    out.push({
      id: `ucdp-${get(row, iId) || r}`,
      year: toInt(get(row, iY)),
      title: `${get(row, iType) || "Armed conflict"} — ${get(row, iCountry) || "Unknown"}`,
      description: composeDeaths(
        `${get(row, iType) || "Armed conflict"} in ${get(row, iCountry) || "Unknown"}.`,
        get(row, iDeaths)
      ),
      lat,
      lon,
      place: get(row, iCountry),
      category: "war",
      source: "domain",
    });
  }
  return out;
}

// ---- EM-DAT (natural disasters) ----
export function parseEmdat(rows: string[][], m: number, d: number): HistoryEvent[] {
  if (rows.length < 2) return [];
  const header = rows[0];
  const iY = colIndex(header, ["year"]);
  const iMo = colIndex(header, ["month"]);
  const iD = colIndex(header, ["day"]);
  const iLat = colIndex(header, ["latitude"]);
  const iLon = colIndex(header, ["longitude"]);
  const iType = colIndex(header, ["disaster type", "disastertype", "disaster_type"]);
  const iSub = colIndex(header, ["disaster subtype", "disastersubtype"]);
  const iCountry = colIndex(header, ["country"]);
  const iDeaths = colIndex(header, ["total deaths", "totaldeaths", "dead"]);
  const iId = colIndex(header, ["dis no", "disno", "id"]);
  const out: HistoryEvent[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const mm = toInt(get(row, iMo));
    const dd = toInt(get(row, iD));
    if (mm !== m || dd <= 0) continue; // EM-DAT uses 0 for unknown day
    const lat = toFloat(get(row, iLat));
    const lon = toFloat(get(row, iLon));
    if (!validCoord(lat, lon)) continue;
    const type = `${get(row, iType) || "Disaster"}${get(row, iSub) ? " (" + get(row, iSub) + ")" : ""}`;
    out.push({
      id: `emdat-${get(row, iId) || r}`,
      year: toInt(get(row, iY)),
      title: `${type} — ${get(row, iCountry) || "Unknown"}`,
      description: composeDeaths(
        `${type} in ${get(row, iCountry) || "Unknown"}.`,
        get(row, iDeaths)
      ),
      lat,
      lon,
      place: get(row, iCountry),
      category: "disaster",
      source: "domain",
    });
  }
  return out;
}

// ---- Load all configured domain CSVs (UCDP + EM-DAT), filter to m/d, merge ----
// Terrorism events are NOT loaded here — they come from Wikidata (CC0) in
// lib/history.ts to avoid GTD's non-commercial license restriction.
// Returns [] if the CSV files are absent.
export async function loadDomainEventsForDate(opts: {
  m: number;
  d: number;
  baseDir?: string;
}): Promise<HistoryEvent[]> {
  const base = opts.baseDir || DATA_DIR;
  const merged: HistoryEvent[] = [];
  const ged = loadCsv(`${base}/ucdp-ged.csv`);
  if (ged) merged.push(...parseGed(ged, opts.m, opts.d).slice(0, DOMAIN_CAP));
  const emd = loadCsv(`${base}/emdat.csv`);
  if (emd) merged.push(...parseEmdat(emd, opts.m, opts.d).slice(0, DOMAIN_CAP));
  return merged;
}

// ---- NASA APOD (free, no key required with DEMO_KEY) — authoritative space imagery ----
export type NasaApod = {
  title: string;
  explanation: string;
  url: string;
  date: string;
  copyright?: string;
} | null;

async function fetchWithTimeout(url: string, ms = 6000): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal } as any);
  } finally {
    clearTimeout(id);
  }
}

export async function fetchNasaApod(
  dateStr: string,
  apiKey = "DEMO_KEY"
): Promise<NasaApod> {
  try {
    const res = await fetchWithTimeout(
      `https://api.nasa.gov/planetary/apod?api_key=${apiKey}&date=${dateStr}`
    );
    if (!res.ok) return null;
    const j = (await res.json()) as any;
    if (j.media_type && j.media_type !== "image") return null;
    return {
      title: j.title || "",
      explanation: j.explanation || "",
      url: j.url || "",
      date: j.date || dateStr,
      copyright: j.copyright,
    };
  } catch {
    return null;
  }
}
