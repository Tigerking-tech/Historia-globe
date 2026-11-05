// 全局配置：品牌、SEO、Creem 支付、UNESCO 数据、LLM 问达
const config = {
  appName: "Historia Globe",
  appDescription:
    "See the whole world's history at once. Pick any date and explore the global events that shaped it — on an interactive globe, with an AI that connects the threads across continents.",
  domainName: "historiaglobe.com",

  // Creem 支付（模板已接好；填入你的 Creem 测试/正式密钥即可启用结账）
  creem: {
    url: process.env.CREEM_API_URL || "https://api.creem.io",
    pricingTableId: process.env.CREEM_PRICING_TABLE_ID || "",
    webhookSecret: process.env.CREEM_WEBHOOK_SECRET || "",
  },

  // LLM 问达：兼容 OpenAI 的接口（无 key 时自动降级为"事件串联"本地成文）
  llm: {
    baseUrl: process.env.LLM_BASE_URL || "https://api.openai.com/v1",
    apiKey: process.env.LLM_API_KEY || "",
    model: process.env.LLM_MODEL || "gpt-4o-mini",
  },

  // UNESCO 官方开放数据门户 data.unesco.org（底层 OpenDataSoft 技术栈）
  // 数据集 whc001 =《世界遗产名录》，1273 条带经纬度的真实记录
  unesco: {
    dataset: "whc001",
    baseUrl: "https://data.unesco.org/api/explore/v2.1/catalog/datasets",
  },

  // 兼容模板字段
  stripe: { plans: [] },
  email: {
    subdomain: "historiaglobe",
    fromNoReply: "noreply@historiaglobe.com",
    fromAdmin: "hello@historiaglobe.com",
    supportEmail: "hello@historiaglobe.com",
  },
};

export default config;
