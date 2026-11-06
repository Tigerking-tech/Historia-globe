/** 已核验的本地策展真实照片集（受限网络兜底）
 *
 * 全站统一「照片幻灯片」后，任何事件都由 /api/reel 按需返回一组自由授权真实照片。
 * 沙箱 / 受限网络直连 commons.wikimedia.org、upload.wikimedia.org、en.wikipedia.org
 * 全部超时，在线检索拿不到素材，播放器会显示诚实占位。为了在任何网络下都能真实
 * 演示「照片轮换」这一形态，这里缓存了两组**逐张目视确认并核对许可**的真实史料照片：
 *
 *   - 1949 开国大典（Wikimedia Commons，PD-China 公有领域）
 *   - 2001 9/11（Wikimedia Commons，PD-USGov / NOAA / NIST / US Navy 公有领域）
 *
 * 这些都是**免费可商用、无需另行取得授权**的素材（不同于已删除的需商用授权央视胶片）。
 * 逐张署名与法务边界见 docs/REEL-COMMONS-CREDITS.md。
 *
 * 注意：这只是「已核验的固定策展素材 + 受限网络兜底」，不是为每个事件预生成内容；
 * 上线 Vercel 境外直连后，其余事件由在线检索 Commons 自动补全。
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
  id: "1949" | "911";
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
    id: "1949",
    source: "curated-1949",
    disclosureZh: "维基共享资源公有领域史料照片 · 幻灯片轮换 · 逐张署名见 docs/REEL-COMMONS-CREDITS.md · 面向欧美商用前须复核 PD-China 的 URAA 风险",
    disclosureEn: "Public-domain Commons archival photos · slideshow · credits in docs/REEL-COMMONS-CREDITS.md · verify PD-China URAA status before US/EU commercial use",
    badgeZh: "真实史料照片 · 幻灯片",
    badgeEn: "Archival photos · slideshow",
    slides: [
      {
        url: "/reel/slides/1949-proclamation.jpg",
        sourcePage: COMMONS + "File:Founding_Ceremony_of_People%27s_Republic_of_China.jpg",
        author: "Unknown author",
        licenseShort: "Public domain (PD-China)",
        licenseUrl: COMMONS + "Template:PD-China",
        title: "城楼宣告",
        note: "1949-10-01 · 天安门城楼上的历史一刻",
        width: 900,
        height: 472,
        verified: true,
      },
      {
        url: "/reel/slides/1949-tiananmen-feb.jpg",
        sourcePage: COMMONS + "File:Tiananmen_1949.jpg",
        author: "Unknown author",
        licenseShort: "Public domain (per Wikimedia Commons mirror)",
        licenseUrl: COMMONS + "Template:PD-China",
        title: "那年的城楼",
        note: "1949-02-12 · 北平和平解放后的天安门",
        width: 900,
        height: 663,
        verified: false,
      },
      {
        url: "/reel/slides/1949-ji1-stamp.jpg",
        sourcePage: COMMONS + "File:Ji1,_4-1,_Beijing_Tiananmen,_1949.jpg",
        author: "张仃、钟灵（设计）／孙传哲（版图绘制）",
        licenseShort: "Public domain (PD-China)",
        licenseUrl: COMMONS + "Template:PD-China",
        title: "开国邮票",
        note: "1949-10-08 · 纪1 纪念邮票上的天安门",
        width: 900,
        height: 1075,
        verified: true,
      },
    ],
  },
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

/** 命中条件：只把对应的照片给对应的事件，避免给不相干事件配错史料。
 *  1949 支持「开国大典 / 天安门 / 1949 / 10.1」等写法；911 支持「911 / 9.11 / 世贸 / WTC」等。*/
export function matchCuratedSet(e: ReelEventInput): CuratedSet | null {
  const s = `${e.q || ""} ${e.title || ""} ${e.place || ""}`.toLowerCase();
  const q = (e.q || "").trim();

  if (/开国|大典|国庆|天安门|founding ceremony|proclamation of the people|tiananmen/i.test(s)) return CURATED_SETS[0];
  if (/^10[.\-/月]0?1(日)?$/.test(q) || /^1949([.\-/年]|$)/.test(q)) return CURATED_SETS[0];
  if (/\b1949\b/.test(s) && /china|beijing|prc|中国|北京/i.test(s)) return CURATED_SETS[0];

  if (/\b9\/?11\b|\b911\b|9[.\-/]11|september 11|世贸|双子塔|双塔|world trade center|\bwtc\b|ground zero|归零地/i.test(s)) return CURATED_SETS[1];
  if (/^2001[.\-/年]/.test(q) && /9[.\-/]0?11/.test(q)) return CURATED_SETS[1];

  return null;
}

/** 事件坐标/标题覆盖：策展集自带准确的元数据，避免前端传参不准导致地球飞错地方 */
export function curatedEventOverride(set: CuratedSet, lang: "zh" | "en") {
  if (set.id === "1949") {
    return {
      title: lang === "en" ? "Founding Ceremony of the PRC" : "开国大典",
      year: 1949,
      place: lang === "en" ? "Tian'anmen, Beijing" : "北京天安门",
      category: "politics",
      lat: 39.9,
      lon: 116.4,
    };
  }
  return {
    title: lang === "en" ? "September 11 attacks" : "9·11 恐怖袭击",
    year: 2001,
    place: lang === "en" ? "World Trade Center, New York" : "纽约世贸中心",
    category: "conflict",
    lat: 40.71,
    lon: -74.01,
  };
}
