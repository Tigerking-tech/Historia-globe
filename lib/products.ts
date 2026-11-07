// 产品与定价的真实定义。
//
// 诚实原则：这里只定义「已经想清楚要卖什么、卖多少钱」，不假装钱已经能到账。
// 是否可售由 lib/payments.ts 依据真实凭证决定；未配置时定价页与 checkout 都会
// 明确显示「支付尚未启用」，绝不返回假的结账链接或假的订单。

export type ProductKind = "free" | "one-time" | "subscription";

export type Product = {
  sku: string;
  name: string;
  nameZh: string;
  kind: ProductKind;
  /** 美元；0 表示免费 */
  priceUsd: number;
  /** 是否属于当前可购买的商品（订阅一律先不做，见 P0 决策） */
  sellable: boolean;
  description: string;
  descriptionZh: string;
  features: string[];
  featuresZh: string[];
  /** 依赖账号体系、尚未实现的功能，必须显式标注 */
  planned?: string[];
  plannedZh?: string[];
};

/** 一次性小额包：绕开「新商户订阅权限难拿」+「无限 AI 的 token 成本」两个坑。
 *  也匹配 ChatGPT 流量偏年轻、适合小额一次性付费的特征。 */
export const ARCHIVAL_PASS: Product = {
  sku: "archival-pass",
  name: "Archival Pass",
  nameZh: "史料通行证",
  kind: "one-time",
  priceUsd: 4,
  sellable: true,
  description:
    "A one-time $4 pass. No subscription, no auto-renewal. Unlock the classroom presentation mode, unlimited CSV exports with source links, and the full archival slideshow library.",
  descriptionZh:
    "一次性 4 美元，不订阅、不自动续费。解锁课堂演示模式、含出处链接的无限次 CSV 导出，以及完整史料幻灯片库。",
  features: [
    "One-time purchase, no recurring charge",
    "Presentation / large-type display mode",
    "Unlimited CSV export including source URLs",
    "Full archival photo slideshow library with per-image credits",
    "Everything else on the site stays free",
  ],
  featuresZh: [
    "一次性购买，不产生持续扣费",
    "演示 / 大字显示模式",
    "含原始出处链接的无限次 CSV 导出",
    "完整史料照片幻灯片库，逐张署名",
    "站内其余功能依旧全部免费",
  ],
  planned: ["Cloud sync of saved places", "Daily On This Day email"],
  plannedZh: ["收藏地点跨设备云同步", "每日「历史上的今天」邮件"],
};

export const FREE_TIER: Product = {
  sku: "wanderer",
  name: "Wanderer",
  nameZh: "漫游者",
  kind: "free",
  priceUsd: 0,
  sellable: true,
  description: "Everything that exists today, free, with no account and no card.",
  descriptionZh: "今天已经做出来的一切，全部免费，无需账号、无需绑卡。",
  features: [
    "Explore any date on the interactive globe",
    "Clickable source links for every event",
    "Archival photo slideshow with per-image credits",
    "Right Now: street-level photo, local time and live weather",
    "Category filters, day tour and shareable view links",
    "Light / high-contrast / presentation display modes",
    "Locate me: Right Now at your own GPS position",
  ],
  featuresZh: [
    "在交互地球上探索任意日期",
    "每个事件都有可点击的原始出处",
    "真实史料照片幻灯片，逐张署名",
    "此刻此地：地面实景 + 当地时间 + 实时天气",
    "类别筛选、镜头巡游、可还原的分享链接",
    "浅色高对比 / 演示大字显示模式",
    "定位到我：用 GPS 查看我脚下此刻的样子",
  ],
};

export const PRODUCTS: Product[] = [FREE_TIER, ARCHIVAL_PASS];

export function getProduct(sku: string): Product | null {
  return PRODUCTS.find((p) => p.sku === sku) || null;
}

/** 商品目录：只包含一次性包与免费层。订阅档位本轮不做，避免虚假宣传。 */
export function sellableProducts(): Product[] {
  return PRODUCTS.filter((p) => p.sellable);
}
