// ============================================================================
// 地标实景照片表（「此刻此地」L1 图源）
//
// 产品目的：历史事件发生在具体地点时，展示**该地点现在的地面实景**
// （例如 1949-10-01 开国大典 → 今天的天安门城楼），而不是卫星俯视图。
//
// 许可证：Pexels License —— 可免费商用、可用于网站/产品、可裁剪，
//         无需强制署名（本产品仍保留 credit）。禁止把照片本身转售或
//         另建竞品图库。详见 LICENSE-THIRD-PARTY.md。
//
// 工程约束：只保存数字 ID，URL 在服务端构造并由 /api/now 同源代理转发，
//          浏览器不直连第三方 CDN，移动端不依赖 images.pexels.com 可达性。
//          这些是「该地点近期真实地面照片」，不是实时摄像头，也不是历史照片。
// ============================================================================

export type Landmark = {
  key: string;
  en: string;
  zh: string;
  /** 地标精确坐标（用于坐标匹配与展示） */
  lat: number;
  lon: number;
  /** 命中半径（km）：事件坐标常为城市级近似值，需容忍一定偏差 */
  radiusKm: number;
  /** Pexels 数字 ID，首选照片排在前面（优先横构图、白天地标全景） */
  photos: string[];
  /** 事件 place / title 关键词（小写），作为坐标之外的补充匹配 */
  keywords: string[];
};

export const LANDMARKS: Landmark[] = [
  {
    key: "tiananmen",
    en: "Tiananmen Square",
    zh: "天安门广场",
    lat: 39.9087,
    lon: 116.3975,
    radiusKm: 3.5,
    // 已逐张目视确认：白天正面城楼 + 国旗 + 广场人群，最贴合「开国大典发生地·如今」
    photos: ["30346248", "5075264", "34266996", "6989329", "9817994", "9754040", "31427555", "2975021"],
    keywords: ["tiananmen", "天安门", "beijing", "北京", "people's republic", "founded"],
  },
  {
    key: "newyork",
    en: "New York · Statue of Liberty",
    zh: "纽约 · 自由女神像",
    lat: 40.6892,
    lon: -74.0445,
    radiusKm: 12,
    photos: ["5324291", "5413933", "6306932", "3913354", "7758569", "33620005"],
    keywords: ["new york", "nyc", "manhattan", "wall street", "united nations", "liberty"],
  },
  {
    key: "tokyo",
    en: "Tokyo",
    zh: "东京",
    lat: 35.6762,
    lon: 139.6503,
    radiusKm: 15,
    photos: ["16571142", "27164620", "34163234", "31385181", "15829192", "35072446"],
    keywords: ["tokyo", "东京", "edo"],
  },
];

/** Pexels CDN 直链（仅服务端使用；已验证 w=760/900 均可达） */
export function pexelsPhotoUrl(id: string, w = 900): string {
  return `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}`;
}

/** 球面距离（km） */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * 按坐标 + 事件地点关键词匹配地标。
 * 关键词命中优先（事件 place 常为城市名），坐标命中兜底，取距离最近者。
 */
export function findLandmark(lat: number, lon: number, hint = ""): { landmark: Landmark; km: number } | null {
  const h = hint.toLowerCase();
  let best: { landmark: Landmark; km: number } | null = null;
  for (const lm of LANDMARKS) {
    const km = distanceKm(lat, lon, lm.lat, lm.lon);
    const keywordHit = lm.keywords.some((k) => h.includes(k));
    const coordHit = km <= lm.radiusKm;
    if (!keywordHit && !coordHit) continue;
    // 关键词命中给一个距离折扣，避免城市级坐标把别的地标拉进来
    const score = keywordHit ? km * 0.35 : km;
    const bestScore = best ? (best.landmark.keywords.some((k) => h.includes(k)) ? best.km * 0.35 : best.km) : Infinity;
    if (score < bestScore) best = { landmark: lm, km };
  }
  return best;
}
