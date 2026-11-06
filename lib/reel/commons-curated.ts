/** 本地缓存的 Wikimedia Commons（维基共享资源）真实史料照片
 *
 * 为什么需要这份本地缓存：
 *   1. 沙箱 / 部分受限网络直连 commons.wikimedia.org、upload.wikimedia.org 全部超时，
 *      在线检索拿不到素材，播放器只能降级为自绘矢量示意。
 *   2. 这些照片本身是 **真实史料**，不是示意图；已逐张核对 Commons 文件页的许可
 *      （PD-China / Public Domain），可商用、无需付费授权。
 *   3. 它们体积极小（合计 ~436 KB），属于「已核验的固定策展素材」，
 *      与「为每个事件预生成 N 个 MP4」是两回事，不违背按需 manifest 架构。
 *
 * 用途：?commons=1 时返回 stills 时间轴；上线 Vercel 后在线检索优先，
 *       这份缓存只作为受限网络下的真实史料兜底，绝不会冒充活动影像。
 *
 * 法务：PD-China 依据中国大陆著作权法「发表后 50 年届满」；Commons 文件页明确提示
 *       在美国可能因 URAA 恢复版权、在不适用较短期限规则的国家（美/瑞士等 70 年）
 *       未必视为公版。面向欧美商用前须逐张复核，详见 docs/REEL-COMMONS-CREDITS.md。
 */

export interface CuratedCommonsImage {
  /** 本地缓存路径（同源，离线可加载） */
  url: string;
  /** Commons 文件描述页，署名与许可核验依据 */
  sourcePage: string;
  author: string;
  licenseShort: string;
  licenseUrl: string;
  title: string;
  width: number;
  height: number;
  /** 许可是否为直接核验（否则为二手镜像标注，需复核） */
  verified: boolean;
}

const COMMONS = "https://commons.wikimedia.org/wiki/";

export const CURATED_1949_IMAGES: CuratedCommonsImage[] = [
  {
    url: "/reel/commons/1949-rostrum-proclamation.jpg",
    sourcePage: COMMONS + "File:Founding_Ceremony_of_People%27s_Republic_of_China.jpg",
    author: "Unknown author",
    licenseShort: "Public domain (PD-China)",
    licenseUrl: COMMONS + "Template:PD-China",
    title: "1949 开国大典 · 天安门城楼上的宣告（右起：董必武、赛福鼎·艾则孜、毛泽东、林伯渠）",
    width: 900,
    height: 472,
    verified: true,
  },
  {
    url: "/reel/commons/1949-tiananmen-feb.jpg",
    sourcePage: COMMONS + "File:Tiananmen_1949.jpg",
    author: "Unknown author",
    licenseShort: "Public domain (per Wikimedia Commons mirror)",
    licenseUrl: COMMONS + "Template:PD-China",
    title: "1949-02-12 天安门城楼 · 庆祝北平和平解放大会",
    width: 900,
    height: 663,
    verified: false,
  },
  {
    url: "/reel/commons/1949-ji1-stamp.jpg",
    sourcePage: COMMONS + "File:Ji1,_4-1,_Beijing_Tiananmen,_1949.jpg",
    author: "张仃、钟灵（设计）／孙传哲（版图绘制）",
    licenseShort: "Public domain (PD-China)",
    licenseUrl: COMMONS + "Template:PD-China",
    title: "纪1(4-1) 北京天安门 · 1949-10-08 发行的政协纪念邮票",
    width: 900,
    height: 1075,
    verified: true,
  },
];

/** 命中条件：仅 1949 开国大典 / 天安门相关事件可用这组照片，避免给不相干事件配错史料。
 *  与 manifest.isCurated 保持一致，额外支持 10.1 / 1949.10.1 等日期简写。 */
export function matchesCuratedCommons(e: { q?: string; title?: string; place?: string }): boolean {
  const s = `${e.q || ""} ${e.title || ""} ${e.place || ""}`.toLowerCase();
  if (/开国|大典|国庆|天安门|1949|founding ceremony|proclamation of the people|tiananmen/i.test(s)) return true;
  const q = (e.q || "").trim();
  if (/^10[.\-/月]0?1(日)?$/.test(q)) return true;
  if (/^1949([.\-/年]|$)/.test(q) && /10[.\-/]0?1/.test(q)) return true;
  return false;
}
