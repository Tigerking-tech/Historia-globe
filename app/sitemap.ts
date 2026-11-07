import type { MetadataRoute } from "next";
import config from "@/config";
import {
  everyDateSlug,
  allDateSlugs,
  allEventSlugs,
  allPlaceSlugs,
  getDateContent,
  getEventContent,
  getPlaceContent,
} from "@/lib/content";

const base = `https://${config.domainName}`;

/** 全量 URL 清单：核心页 + 366 个日期页 + 全部事件页 + 地点页 + 法务页。
 *  有策展事件的日期优先级更高（lastModified 与 changeFrequency 区分）。 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const core: MetadataRoute.Sitemap = [
    { url: base, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/explore`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/for-teachers`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/reel.html`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    ...["privacy", "terms", "refund", "contact"].map((d) => ({
      url: `${base}/legal/${d}`,
      lastModified: now,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];

  const withEvents = new Set(allDateSlugs());
  const dates: MetadataRoute.Sitemap = everyDateSlug().map((slug) => ({
    url: `${base}/on-this-day/${slug}`,
    lastModified: now,
    changeFrequency: withEvents.has(slug) ? "monthly" : "yearly",
    priority: withEvents.has(slug) ? 0.7 : 0.4,
  }));

  const events: MetadataRoute.Sitemap = allEventSlugs().map((slug) => {
    const e = getEventContent(slug);
    return {
      url: `${base}/event/${slug}`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: e && e.year >= 1900 ? 0.65 : 0.55,
    };
  });

  const places: MetadataRoute.Sitemap = allPlaceSlugs().map((slug) => ({
    url: `${base}/place/${slug}`,
    lastModified: now,
    changeFrequency: "yearly",
    priority: 0.5,
  }));

  return [...core, ...dates, ...events, ...places];
}
