/** 已核验的本地策展真实照片集（受限网络兜底）
 *
 * 2026-11-06 URAA 复核结论：**1949 开国大典组（Wikimedia Commons PD-China）已整体移除**。
 *
 * 依据 17 U.S.C. §104A(h)(6)，美国恢复外国作品版权的前提之一是「作品在来源国
 * 未因保护期届满进入公有领域」。中国 URAA 生效日为 1996-01-01；而 1990 年
 * 《著作权法》第 21 条规定摄影作品保护期为「首次发表后 50 年」——1949 年发表的
 * 照片保护到 1999-12-31，1996 年时在中国仍受保护，恢复条件成立；恢复后美国版权
 * 期限为「首次发表起 95 年」（约至 2044 年底）。Commons 官方规则表对 1946–1953 年
 * 中国作品明确要求 {{Not-PD-US-URAA}}，且 2026 年正在按「Not PD in the US」提删
 * 同类照片。因此面向欧美商用的产品不再使用任何 PD-China 素材。完整复核记录见
 * docs/REEL-COMMONS-CREDITS.md。
 *
 * 现在只剩一组：2001 9/11（PD-USGov / NOAA / NIST / U.S. Navy，17 U.S.C. §105），
 * 属美国联邦政府作品，全球争议最小。逐张署名见 docs/REEL-COMMONS-CREDITS.md。
 *
 * 注意：这只是「已核验的固定策展素材 + 受限网络兜底」，不是为每个事件预生成内容；
 * 上线 Vercel 境外直连后其余事件由在线检索 Commons 补全，并会被 licenses.ts 的
 * URAA 风险过滤拦截，不会把有版权恢复风险的照片重新捡回产品。
 */

import type { ReelEventInput, ReelSourceName } from "./types";

export interface CuratedSlide {
  url: string;
  sourcePage: string;
  author: string;
  licenseShort: string;
  licenseUrl: string;
  /** 幻灯片短标题（<= 10 字，窄屏安全） */
  title: string;
  /** 说明 / 日期 */
  note: string;
  width: number;
  height: number;
  /** 许可是否直接核验（否则为二手镜像标注，需复核） */
  verified: boolean;
}

export interface CuratedSet {
  id: "911";
  source: ReelSourceName;
  disclosureZh: string;
  disclosureEn: string;
  badgeZh: string;
  badgeEn: string;
  slides: CuratedSlide[];
}

const COMMONS = "https://commons.wikimedia.org/wiki/";

export const CURATED_SETS: CuratedSet[] = [
  {
    id: "911",
    source: "curated-911",
    disclosureZh: "维基共享资源公有领域史料照片（NOAA / NIST / 美国海军，PD-USGov）· 幻灯片轮换 · 逐张署名见 docs/REEL-COMMONS-CREDITS.md",
    disclosureEn: "Public-domain Commons archival photos (NOAA / NIST / US Navy, PD-USGov) · slideshow · credits in docs/REEL-COMMONS-CREDITS.md",
    badgeZh: "真实史料照片 · 幻灯片",
    badgeEn: "Archival photos · slideshow",
    slides: [
      {
        url: "/reel/slides/911-ground-zero.jpg",
        sourcePage: COMMONS + "File:Wtc-photo.jpg",
        author: "NOAA (National Oceanic and Atmospheric Administration)",
        licenseShort: "Public domain (PD-USGov-NOAA)",
        licenseUrl: COMMONS + "Template:PD-USGov-NOAA",
        title: "归零地航拍",
        note: "2001-09-23 · NOAA 航拍世贸中心遗址",
        width: 1000,
        height: 1000,
        verified: true,
      },
      {
        url: "/reel/slides/911-site-overlay.jpg",
        sourcePage: COMMONS + "File:World_Trade_Center_Site_After_9-11_Attacks_With_Original_Building_Locations.jpg",
        author: "NOAA / NIST (National Institute of Standards and Technology)",
        licenseShort: "Public domain (PD-USGov)",
        licenseUrl: COMMONS + "Template:PD-USGov",
        title: "遗址标注图",
        note: "2001-09-23 · NIST 标注原建筑位置",
        width: 1000,
        height: 749,
        verified: true,
      },
      {
        url: "/reel/slides/911-firefighter.jpg",
        sourcePage: COMMONS + "File:Firefigher_Smoke_World_Trade_Center_New_York_City_9_2001.jpg",
        author: "Jim Watson / U.S. Navy",
        licenseShort: "Public domain (PD-USGov-Military)",
        licenseUrl: COMMONS + "Template:PD-USGov-Military-Navy",
        title: "烟尘中的消防员",
        note: "2001-09-14 · 美国海军随军记者摄",
        width: 900,
        height: 1372,
        verified: true,
      },
    ],
  },
];

/** 命中条件：只把 9·11 的照片配给 9·11 事件。
 *  1949 / 开国大典 / 10.1 等写法不再命中任何策展集——这些事件的现存史料照片
 *  普遍存在美国 URAA 版权恢复风险，由 isUraaExcludedEvent 生成专用诚实占位。*/
export function matchCuratedSet(e: ReelEventInput): CuratedSet | null {
  const s = `${e.q || ""} ${e.title || ""} ${e.place || ""}`.toLowerCase();
  const q = (e.q || "").trim();
  if (/\b9\/?11\b|\b911\b|9[.\-/]11|september 11|世贸|双子塔|双塔|world trade center|\bwtc\b|ground zero|归零地/i.test(s)) return CURATED_SETS[0];
  if (/^2001[.\-/年]/.test(q) && /9[.\-/]0?11/.test(q)) return CURATED_SETS[0];
  return null;
}

/** 已知「现存史料照片普遍存在 URAA 恢复风险」的事件。
 *  不配本地照片；在线检索也会由 licenses.ts 的 URAA 黑名单兜住，最终显示专用占位。*/
export function isUraaExcludedEvent(e: ReelEventInput): boolean {
  const s = `${e.q || ""} ${e.title || ""} ${e.place || ""}`.toLowerCase();
  const q = (e.q || "").trim();
  if (/开国|大典|国庆|天安门|founding ceremony|proclamation of the people|tiananmen/i.test(s)) return true;
  if (/^10[.\-/月]0?1(日)?$/.test(q) || /^1949([.\-/年]|$)/.test(q)) return true;
  if (/\b1949\b/.test(s) && /china|beijing|prc|中国|北京/i.test(s)) return true;
  return false;
}

/** 事件坐标/标题覆盖：策展集自带准确元数据，避免前端传参不准导致地球飞错地方 */
export function curatedEventOverride(lang: "zh" | "en") {
  return {
    title: lang === "en" ? "September 11 attacks" : "9·11 恐怖袭击",
    year: 2001,
    place: lang === "en" ? "World Trade Center, New York" : "纽约世贸中心",
    category: "conflict",
    lat: 40.71,
    lon: -74.01,
  };
}
