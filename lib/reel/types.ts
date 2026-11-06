/** 「回到那一刻」统一照片幻灯片 — 共享类型
 *
 * 全项目只用一种形态：**真实照片幻灯片（slideshow）**。
 * 没有视频、没有矢量示意、没有 Ken Burns 运镜；素材全部来自免费授权图库，
 * 逐张保留许可与署名。服务端不生成、不存储任何视频，只返回一份很小的清单 JSON。
 *
 * 背景：绝大多数历史事件不存在「当年拍摄的连续活动影像」，能自由商用的更少。
 * 与其用视频通道、照片配运镜、矢量示意三级混搭，不如全站统一为「照片轮换」。
 *
 * 2026-11-06 URAA 复核后，PD-China 等「来源国过期型公有领域」素材已整体排除：
 * 它们在中国已进公版，但在美国可能因 17 U.S.C. §104A 恢复版权（约至 2044 年）。
 * 详见 docs/REEL-COMMONS-CREDITS.md。
 */

export type ReelSourceName =
  | "commons-image"
  | "wikipedia"
  | "curated-911";

export type SourceStatus = "ok" | "empty" | "unreachable" | "filtered" | "disabled";

export interface SourceReport {
  name: ReelSourceName;
  status: SourceStatus;
  count?: number;
  ms?: number;
  detail?: string;
}

/** 单张素材的许可与署名信息（CC BY / BY-SA 要求保留） */
export interface LicenseInfo {
  short: string;
  url: string;
  author: string;
  attributionRequired: boolean;
  sourcePage: string;
  source: ReelSourceName;
}

/** 一张幻灯片 = 一张自由授权真实照片 + 逐张署名 */
export interface ReelSlide {
  index: number;
  /** 同源缓存路径或上游 CDN 地址（上游地址经 host 白名单校验） */
  url: string;
  /** 短标题（如「01　归零地航拍」） */
  title: string;
  /** 日期 / 说明（如「2001-09-23 · NOAA 航拍」） */
  note: string;
  /** 逐张展示的完整署名行 */
  caption: string;
  width?: number;
  height?: number;
  license: LicenseInfo;
}

export interface ReelEventInput {
  /** 原始检索串（如 "10.1" / "911"），也可能是页面标题 */
  q?: string;
  eventId?: string;
  title: string;
  year?: number;
  place?: string;
  category?: string;
  lat?: number | null;
  lon?: number | null;
  lang?: "zh" | "en";
  month?: number;
  day?: number;
}

export interface ReelManifest {
  version: 2;
  /** 缓存键：同一事件稳定不变（ASCII 安全，会写入 X-Reel-Key 响应头） */
  key: string;
  /** slides = 有可用照片；empty = 暂无可安全商用的照片，前端显示诚实占位（仍是同一套幻灯片容器） */
  mode: "slides" | "empty";
  /** empty 的原因：普通没检索到 / 该事件素材已被 URAA 风险排除 */
  emptyReason?: "no-photo" | "uraa-excluded";
  event: {
    title: string;
    year: number | null;
    place: string;
    category: string;
    lat: number | null;
    lon: number | null;
    lang: "zh" | "en";
  };
  slides: ReelSlide[];
  /** 每张照片停留时长（毫秒） */
  slideMs: number;
  /** 诚实标注：这组照片是什么、从哪来，绝不含糊 */
  disclosure: string;
  /** 播放器角标（短） */
  badge: string;
  attributions: string[];
  sources: SourceReport[];
  /** 是否来自本地已核验缓存（受限网络兜底） */
  offline: boolean;
  generatedAt: string;
}
