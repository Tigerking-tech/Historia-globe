import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

// 上线后运维核查：逐个短超时探测外部数据源，如实返回可达 / 不可达。
// 沙箱内多数境外源不可达，这里不会谎报；Vercel 境外部署后可用它一键确认补齐情况。
const PROBES: { key: string; url: string; label: string }[] = [
  { key: "wikipedia", url: "https://en.wikipedia.org/w/api.php?action=query&meta=siteinfo&format=json", label: "Wikipedia API" },
  { key: "wikidata", url: "https://query.wikidata.org/sparql?query=ASK%7B%7D&format=json", label: "Wikidata SPARQL" },
  { key: "commons", url: "https://commons.wikimedia.org/w/api.php?action=query&meta=siteinfo&format=json", label: "Wikimedia Commons" },
  { key: "esri", url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/0/0/0", label: "Esri World Imagery" },
  { key: "unesco", url: "https://data.unesco.org/api/explore/v2.1/catalog/datasets/whc001/records?limit=1", label: "UNESCO World Heritage" },
];

const UA = "HistoriaGlobe/1.0 (source-health probe; https://historiaglobe.com)";

export async function GET() {
  const results = await Promise.all(
    PROBES.map(async (p) => {
      const t0 = Date.now();
      try {
        const r = await fetch(p.url, {
          headers: { "User-Agent": UA, Accept: "*/*" },
          signal: AbortSignal.timeout(5000),
          cache: "no-store",
        });
        return { key: p.key, label: p.label, ok: r.ok, status: r.status, ms: Date.now() - t0 };
      } catch (e: any) {
        return { key: p.key, label: p.label, ok: false, status: 0, ms: Date.now() - t0, error: String(e?.name || e) };
      }
    })
  );
  const reachable = results.filter((r) => r.ok).length;
  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    reachable,
    total: results.length,
    // 如实说明：本环境（沙箱/Vercel 区域）不代表全球用户网络
    note:
      "Reachability is measured from this deployment's egress, not from every user's network. Unreachable sources are auto-merged when the deployment can reach them; the UI shows reduced curated data and says so honestly otherwise.",
    sources: results,
  });
}
