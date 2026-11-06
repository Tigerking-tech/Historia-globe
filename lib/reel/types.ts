/** 「回到那一刻」通用 10 秒影像 — 共享类型
 *
 * 设计前提：不为每个事件预生成 / 预存 MP4。
 * 服务端只在被请求时返回一份很小的「时间轴描述」(ReelManifest)，
 * 素材 URL 指向免费授权图源 CDN，由浏览器直连取用。
 */

export type ReelMode = "footage" | "stills" | "schematic";

export type ReelSourceName = "commons-image" | "commons-video" | "archive" | "wikipedia" | "curated" | "fixture";

export type SourceStatus = "ok" | "empty" | "unreachable" | "filtered" | "disabled";

export interface SourceReport {
  name: ReelSourceName;
  status: SourceStatus;
  count?: number;
  ms?: number;
  detail?: string;
}

/** 单个素材的许可与署名信息（CC BY / BY-SA 要求保留） */
export interface LicenseInfo {
  short: string;
  url: string;
  author: string;
  attributionRequired: boolean;
  sourcePage: string;
  source: ReelSourceName;
}

export interface ReelAsset {
  kind: "image" | "video";
  /** 浏览器直连的上游 CDN 地址（不经本站代理、不落盘） */
  url: string;
  /** 海报 / 缩略图，用于视频封面与图片降级 */
  posterUrl?: string;
  width?: number;
  height?: number;
  title?: string;
  license: LicenseInfo;
  /** 检索相关性得分，越大越靠前 */
  score: number;
}

/** 一镜的运镜参数（Ken Burns），全部确定性生成，保证 CDN 缓存一致 */
export interface KenBurns {
  fromScale: number;
  toScale: number;
  fromX: number;
  toX: number;
  fromY: number;
  toY: number;
}

export interface ReelShot {
  index: 0 | 1 | 2;
  start: number;
  end: number;
  title: string;
  note: string;
  /** 指向 manifest.assets，footage/schematic 模式为 -1 */
  assetIndex: number;
  pan: KenBurns;
}

export interface ReelEventInput {
  /** 原始检索串（如 "10.1"），也可能是页面标题 */
  q?: string;
  eventId?: string;
  title: string;
  year?: number;
  place?: string;
  category?: string;
  lat?: number | null;
  lon?: number | null;
  lang?: "zh" | "en";
  /** 事件发生的月日，用于字幕 */
  month?: number;
  day?: number;
}

export interface ReelManifest {
  version: 1;
  /** 缓存键：同一事件稳定不变 */
  key: string;
  mode: ReelMode;
  duration: 10;
  event: {
    title: string;
    year: number | null;
    place: string;
    category: string;
    lat: number | null;
    lon: number | null;
    lang: "zh" | "en";
  };
  /** 诚实标注：这段 10 秒到底是什么，绝不含糊 */
  disclosure: string;
  /** 播放器角标文案（短） */
  badge: string;
  shots: ReelShot[];
  assets: ReelAsset[];
  /** footage 模式：可播放的视频 URL；stills/schematic 为空 */
  videoUrl?: string;
  /** footage 模式：从视频的哪一秒开始取 10 秒窗口 */
  videoOffset?: number;
  attributions: string[];
  sources: SourceReport[];
  /** 是否来自本地离线演示数据（绝不会在生产命中） */
  fixture: boolean;
  generatedAt: string;
}
