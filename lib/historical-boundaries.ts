// 历史边界图层：只读数据层。
//
// 诚实边界（与「每条都能核对出处」这条核心差异化对齐）：
//  1) 每个内置图层都有数据集级出处（名称 / 许可 / 原始 URL / 学术引用 / 精度声明）；
//  2) 每个政体要素都带自己的 Wikipedia 链接，可逐要素点开核对；
//  3) 明确区分「数据集级出处 + 维基条目」与「一手史料」，不冒充权威原始材料；
//  4) 没有数据的年份不插值、不编造；滑块只对齐到真实存在的面板年；
//  5) 许可不兼容或未经评估的数据集一律登记但**不内置**，理由可核对。
//
// 数字全部来自构建期生成的 data/historical-boundaries.json，不写推断值。

import manifest from "../data/historical-boundaries.json";

export type BoundaryKind = "bundled" | "not-bundled" | "reference" | "competitor";

export type BoundarySource = {
  id: string;
  name: string;
  licence: string;
  licenceUrl: string;
  url: string;
  kind: BoundaryKind;
  coverage: string;
  checkedOn: string;
  reason: string;
};

/** 2026-11-08 用 GitHub API 与数据源站点真实核对过的轮子清单。 */
export const BOUNDARY_SOURCES: BoundarySource[] = [
  {
    id: "cliopatria",
    name: "Aligned Cliopatria v1.1 (UC Merced GIS Center)",
    licence: "CC BY 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by/4.0/",
    url: "https://github.com/ucmerced-giscenter/cliopatria",
    kind: "bundled",
    coverage: "-3400 to 1497 · 333 panel years · 52,044 polity features",
    checkedOn: "2026-11-08",
    reason:
      "内置。CC BY 4.0 允许再分发（已署名并注明几何简化）；每个政体带 Name / Wikipedia 字段，可做到逐要素出处。源仓库代码 MIT、数据 CC BY 4.0，源自 Cliopatria v0.0.1 (Zenodo DOI 10.5281/zenodo.13363121)。",
  },
  {
    id: "natural-earth",
    name: "Natural Earth 1:110m Admin-0 Countries",
    licence: "Public domain",
    licenceUrl: "https://www.naturalearthdata.com/about/terms-of-use/",
    url: "https://www.naturalearthdata.com/",
    kind: "bundled",
    coverage: "Present-day baseline (year 2026 slider position)",
    checkedOn: "2026-11-08",
    reason: "内置。项目原有的 /countries.geojson 即此数据集，公有领域；只作为「现代」档位，不冒充历史重建。",
  },
  {
    id: "historical-basemaps",
    name: "aourednik/historical-basemaps (★876)",
    licence: "GPL-3.0",
    licenceUrl: "https://www.gnu.org/licenses/gpl-3.0.html",
    url: "https://github.com/aourednik/historical-basemaps",
    kind: "not-bundled",
    coverage: "100 to 2010 · 37 world_<year>.geojson files",
    checkedOn: "2026-11-08",
    reason:
      "不内置。GPL-3.0 对要商业上线的专有站点存在衍生作品与再分发风险；且 README 自述为 work in progress、要求使用前与别源核对。它能补齐 1500–2010 的历史边界，但需法务评估后再定，不擅自引入。",
  },
  {
    id: "openhistoricalmap",
    name: "OpenHistoricalMap + maplibre-gl-dates",
    licence: "ODbL / CC0-1.0",
    licenceUrl: "https://opendatacommons.org/licenses/odbl/1-0/",
    url: "https://github.com/OpenHistoricalMap/maplibre-gl-dates",
    kind: "reference",
    coverage: "OHM 按 start_decdate / end_decdate 过滤；插件本身不含边界数据",
    checkedOn: "2026-11-08",
    reason:
      "参考。maplibre-gl-dates（CC0-1.0，★17）提供「按日期过滤要素」的思路，本项目用离散真实面板年实现同等效果，未引入 MapLibre 依赖。OHM 数据为 ODbL，署名与 share-alike 义务未评估，暂不内置。",
  },
  {
    id: "geacron",
    name: "GeaCron (竞品)",
    licence: "Proprietary",
    licenceUrl: "",
    url: "https://www.geacron.com/",
    kind: "competitor",
    coverage: "3000 BC to present (商业时间轴)",
    checkedOn: "2026-11-08",
    reason:
      "竞品对照。historical-basemaps 的 README 明确写它「不提供可用于 GIS 的多边形提取」，商业版才有时间轴。本项目不复制其闭源数据，改以公开许可数据集 + 可核对出处竞争。",
  },
];

export type BoundaryLayer = {
  year: number;
  file: string;
  polityCount: number;
  withWikipedia: number;
  bytes: number;
  samplePolities: string[];
};

type Manifest = {
  status: string;
  dataset: Record<string, string>;
  modern: Record<string, string | number>;
  panelYearsAvailableInSource: number;
  bundledYears: number[];
  layers: BoundaryLayer[];
  notes: string[];
};

const data = manifest as unknown as Manifest;

export const BOUNDARY_STATUS = data.status;
export const BOUNDARY_DATASET = data.dataset;
export const MODERN_LAYER = data.modern;
export const BOUNDARY_LAYERS: BoundaryLayer[] = data.layers ?? [];
export const BOUNDARY_YEARS: number[] = data.bundledYears ?? [];
export const PANEL_YEARS_IN_SOURCE = data.panelYearsAvailableInSource;
export const BOUNDARY_NOTES: string[] = data.notes ?? [];

export function getBoundaryLayers(): BoundaryLayer[] {
  return BOUNDARY_LAYERS;
}

/** 滑块档位：14 个真实历史面板年 + 1 个现代基线。 */
export function sliderYears(): number[] {
  return [...BOUNDARY_YEARS, Number(MODERN_LAYER.year)].sort((a, b) => a - b);
}

/** 把任意年份对齐到最近的真实档位；没有数据就返回最接近的真实年，绝不插值。 */
export function nearestBoundaryYear(year: number): { year: number; exact: boolean; layer: BoundaryLayer | null } {
  const years = sliderYears();
  if (!years.length) return { year, exact: false, layer: null };
  let best = years[0];
  for (const y of years) if (Math.abs(y - year) < Math.abs(best - year)) best = y;
  const layer = BOUNDARY_LAYERS.find((l) => l.year === best) ?? null;
  return { year: best, exact: best === year, layer };
}

export function boundaryUrlForYear(year: number): string | null {
  const { year: snapped, layer } = nearestBoundaryYear(year);
  if (!layer) return String(MODERN_LAYER.file);
  return snapped === Number(MODERN_LAYER.year) ? String(MODERN_LAYER.file) : layer.file;
}

export function boundaryStats() {
  const totalPolities = BOUNDARY_LAYERS.reduce((n, l) => n + l.polityCount, 0);
  const withWikipedia = BOUNDARY_LAYERS.reduce((n, l) => n + l.withWikipedia, 0);
  return {
    status: BOUNDARY_STATUS,
    layers: BOUNDARY_LAYERS.length,
    totalPolities,
    withWikipedia,
    wikiCoverage: totalPolities ? Math.round((withWikipedia / totalPolities) * 1000) / 10 : 0,
    firstYear: BOUNDARY_YEARS.length ? BOUNDARY_YEARS[0] : null,
    lastYear: BOUNDARY_YEARS.length ? BOUNDARY_YEARS[BOUNDARY_YEARS.length - 1] : null,
    modernYear: Number(MODERN_LAYER.year),
    panelYearsInSource: PANEL_YEARS_IN_SOURCE,
  };
}
