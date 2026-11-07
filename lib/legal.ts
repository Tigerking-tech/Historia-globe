// 法务与合规文档内容。
// 面向欧美 SaaS：Google Ads / 支付通道都要求「真实退款政策、隐私政策、可联系客服」。
// 诚实原则：本轮支付尚未启用，因此退款政策明确写「当前不收款」，
// 并把启用后的规则写清楚；不承诺还不存在的能力。

import config from "@/config";

export type LegalSection = { h: string; hz: string; body: string[]; bodyz: string[] };
export type LegalDoc = {
  slug: string;
  title: string;
  titleZh: string;
  updated: string;
  intro: string;
  introZh: string;
  sections: LegalSection[];
};

export const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || config.email.supportEmail;
export const SUPPORT_EMAIL_VERIFIED = Boolean(process.env.SUPPORT_EMAIL);
export const GITHUB_ISSUES = "https://github.com/Tigerking-tech/Historia-globe/issues";

const OPERATOR = "Historia Globe";

export const LEGAL_DOCS: LegalDoc[] = [
  {
    slug: "privacy",
    title: "Privacy Policy",
    titleZh: "隐私政策",
    updated: "2026-11-07",
    intro:
      "Historia Globe is built to be usable without an account. This policy explains exactly what is stored, what is not, and which third parties are involved.",
    introZh:
      "Historia Globe 的设计目标是无需账号即可使用。本政策如实说明我们会存储什么、不存储什么，以及涉及哪些第三方。",
    sections: [
      {
        h: "No account required",
        hz: "无需账号",
        body: [
          "Browsing the globe, exploring any date, viewing the archival slideshow, using Right Now, exporting CSV and saving places to a personal timeline all work without signing in. We do not require an email address or payment card to look around.",
        ],
        bodyz: [
          "浏览地球、探索任意日期、观看史料幻灯片、使用「此刻此地」、导出 CSV、收藏地点建立个人时间线，均无需登录。四处看看不需要邮箱，也不需要绑卡。",
        ],
      },
      {
        h: "What we store",
        hz: "我们存储什么",
        body: [
          "Saved places and your language / display-mode preference are stored locally in your browser (localStorage), not on our servers. Anonymous, aggregate funnel events (page view, slideshow start, CSV export) and AI-crawler hits are recorded server-side to understand which pages serve readers; these records contain a truncated user-agent and a path, never a name, email, or precise location.",
          "If you create an account, the authentication provider stores your email and a session token. If you grant GPS permission, coordinates are sent to our server only to fetch the street-level photo and local weather for that position, and are not retained in a profile.",
        ],
        bodyz: [
          "收藏地点、语言与显示模式偏好保存在你浏览器的 localStorage 中，不在我们的服务器上。服务端会记录匿名的汇总漏斗事件（页面访问、幻灯片开始、CSV 导出）与 AI 爬虫命中，用于了解哪些页面对读者有用；记录只包含截断的 UA 与路径，绝不含姓名、邮箱或精确位置。",
          "如果你创建账号，认证服务会保存邮箱与会话令牌。如果你授权定位，坐标仅用于向服务端请求该位置的地面实景与当地天气，不会写入个人档案长期保留。",
        ],
      },
      {
        h: "Third-party data sources",
        hz: "第三方数据源",
        body: [
          "Historical events come from our curated set plus Wikipedia and Wikidata when reachable. Archival photos come from Wikimedia Commons and US government public-domain sources (NOAA / NIST / US Navy), each with per-image attribution and licence. Satellite imagery is served through our own proxy from Esri; street-level photos from Panoramax; weather from Open-Meteo. These providers may receive your IP address when your browser or our proxy requests their content. See the Credits page linked in the site footer for the full list.",
        ],
        bodyz: [
          "历史事件来自本地策展集，以及可连通时的维基百科与 Wikidata。史料照片来自维基共享资源与美国政府公有领域来源（NOAA / NIST / 美国海军），每张都保留署名与许可。卫星影像经本站同源代理取自 Esri，地面实景取自 Panoramax，天气取自 Open-Meteo。当浏览器或本站代理请求其内容时，这些服务可能收到你的 IP。完整清单见页脚的署名文档。",
        ],
      },
      {
        h: "Cookies and analytics",
        hz: "Cookie 与统计",
        body: [
          "We do not use advertising cookies or cross-site trackers. A session cookie exists only for signed-in accounts. We do not sell personal data.",
        ],
        bodyz: [
          "我们不使用广告 Cookie 或跨站追踪器。仅登录账号会产生会话 Cookie。我们不出售个人数据。",
        ],
      },
      {
        h: "Contact and changes",
        hz: "联系与变更",
        body: [
          `Questions about this policy: use the contact page or open a GitHub issue. We will post the updated date at the top of this page when the policy changes.`,
        ],
        bodyz: [
          `对本政策有疑问：请使用「联系我们」页面或提交 GitHub Issue。政策变更时，我们会在本页顶部更新生效日期。`,
        ],
      },
    ],
  },
  {
    slug: "terms",
    title: "Terms of Service",
    titleZh: "服务条款",
    updated: "2026-11-07",
    intro: "Straightforward terms for an educational history product built on open data.",
    introZh: "一份基于开放数据构建的历史教育产品的简明条款。",
    sections: [
      {
        h: "What the service is",
        hz: "服务内容",
        body: [
          `${OPERATOR} is an interactive globe that places historical events on a map, pairs them with freely licensed archival photographs, and offers an AI-assisted way to ask about a given day. Event records are curated and merged with open encyclopedic sources; they may be incomplete or contain errors. The product is for learning and exploration, not for legal, safety-critical, or navigational decisions.`,
        ],
        bodyz: [
          `${OPERATOR} 是一颗把历史事件落到地图上的交互地球，配以自由授权史料照片，并提供针对某一天的 AI 辅助问答。事件记录为人工策展并融合开放百科数据，可能不完整或有误。本产品用于学习与探索，不用于法律、安全关键或导航决策。`,
        ],
      },
      {
        h: "Open data and attribution",
        hz: "开放数据与署名",
        body: [
          "All archival photographs carry per-image attribution and licence information. We deliberately exclude material with unresolved US copyright status (for example PD-China works subject to URAA restoration) and never substitute AI-generated images for real archival photos. You may reuse open-data records subject to their upstream licences; retain the attribution when you do.",
        ],
        bodyz: [
          "所有史料照片都带逐张署名与许可信息。我们主动排除美国版权状态存疑的素材（例如受 URAA 版权恢复影响的 PD-China 作品），绝不用 AI 生成图顶替真实史料。你可依上游许可复用开放数据记录，复用时请保留署名。",
        ],
      },
      {
        h: "Acceptable use",
        hz: "可接受使用",
        body: [
          "Do not scrape the service at a rate that degrades it for others, attempt to bypass access controls, or use it to produce unlawful or misleading content. Automated readers and AI crawlers are welcome — see robots.txt.",
        ],
        bodyz: [
          "请勿以影响他人使用的频率抓取本站、尝试绕过访问控制，或用本站生成违法或误导性内容。我们欢迎自动化读取与 AI 爬虫，参见 robots.txt。",
        ],
      },
      {
        h: "Availability and liability",
        hz: "可用性与责任",
        body: [
          "The service is provided as-is. External data sources may be unreachable from some networks; in that case the site shows a reduced curated dataset and says so explicitly rather than presenting it as complete. We are not liable for decisions made from the content.",
        ],
        bodyz: [
          "本服务按「现状」提供。某些网络下外部数据源可能不可达；此时站点会显示精简的本地策展数据并明确标注，而不会伪装成完整数据。我们不承担依据本站内容所作决策的责任。",
        ],
      },
    ],
  },
  {
    slug: "refund",
    title: "Refund & Cancellation Policy",
    titleZh: "退款与取消政策",
    updated: "2026-11-07",
    intro:
      "Read this first: payments are not enabled on this site today. No money is collected, so there is nothing to refund yet.",
    introZh:
      "请先读这一句：本站目前未启用支付，不收取任何费用，因此当前不存在需要退款的交易。",
    sections: [
      {
        h: "Current status",
        hz: "当前状态",
        body: [
          "The pricing page shows a planned one-time Archival Pass. Checkout is not enabled while payment credentials are unconfigured, and no test-mode checkout is presented as a real purchase. If a button on this site cannot complete a purchase, that is a known state, not a broken order — you have not been charged.",
        ],
        bodyz: [
          "定价页展示的是计划中的一次性「史料通行证」。支付凭证未配置期间结账未启用，我们也不会把测试模式结账伪装成真实购买。如果站内按钮无法完成付款，这是已知状态而非失败订单——你没有被扣款。",
        ],
      },
      {
        h: "Policy once checkout goes live",
        hz: "结账启用后的政策",
        body: [
          "The Archival Pass is a one-time purchase, not a subscription: there is no auto-renewal and nothing to cancel. If we enable checkout and you are charged, you may request a full refund within 14 days of purchase by contacting us with the order reference. Refunds are returned to the original payment method. Because the pass is a digital good delivered immediately, we may decline repeat or abusive refund requests.",
        ],
        bodyz: [
          "「史料通行证」为一次性购买，不是订阅：不会自动续费，也无需取消。若我们启用结账且你已完成付款，可在购买后 14 天内凭订单号联系申请全额退款，款项退回原支付方式。由于通行证是即时交付的数字商品，对重复或滥用退款的请求我们可能予以拒绝。",
        ],
      },
      {
        h: "Subscriptions",
        hz: "关于订阅",
        body: [
          "Subscription tiers shown as Planned are not on sale. Should subscriptions launch later, renewal, cancellation and refund terms will be published here before any recurring charge is possible.",
        ],
        bodyz: [
          "标注「计划中」的订阅档位并未开售。若日后开放订阅，续费、取消与退款条款会在任何周期性扣费成为可能之前，先行发布在本页。",
        ],
      },
    ],
  },
  {
    slug: "contact",
    title: "Contact",
    titleZh: "联系我们",
    updated: "2026-11-07",
    intro: "A real, reachable way to get in touch — including a channel that does not depend on this site's mail setup.",
    introZh: "提供真实可达的联系渠道，其中包含不依赖本站邮件配置的兜底方式。",
    sections: [
      {
        h: "GitHub Issues (always reachable)",
        hz: "GitHub Issues（始终可达）",
        body: [
          `The most reliable channel is the project issue tracker: ${GITHUB_ISSUES}. Bug reports, data corrections, licensing questions and refund requests all belong there, and it stays available even if the support mailbox is still being configured.`,
        ],
        bodyz: [
          `最可靠的渠道是项目 Issue 列表：${GITHUB_ISSUES}。缺陷反馈、数据纠错、许可咨询与退款申请都可以在这里提交；即使客服邮箱仍在配置中，该渠道依然可用。`,
        ],
      },
      {
        h: "Email",
        hz: "邮箱",
        body: [
          SUPPORT_EMAIL_VERIFIED
            ? `Support email: ${SUPPORT_EMAIL}. We aim to reply within 3 business days.`
            : `The support mailbox is ${SUPPORT_EMAIL}. This address uses the project domain and must be verified as reachable before checkout is enabled; until then, please use GitHub Issues above so your message is guaranteed to arrive.`,
        ],
        bodyz: [
          SUPPORT_EMAIL_VERIFIED
            ? `客服邮箱：${SUPPORT_EMAIL}。我们力争在 3 个工作日内回复。`
            : `客服邮箱为 ${SUPPORT_EMAIL}。该地址使用项目域名，需在启用结账前验证可达；在此之前请使用上方的 GitHub Issues，以确保你的消息一定能送达。`,
        ],
      },
      {
        h: "Data corrections",
        hz: "数据纠错",
        body: [
          "Every event page links to its Wikipedia search page and every archival photo links to its Commons source page. If a date, coordinate, credit or licence is wrong, open an issue with the page URL and the correct source — corrections are prioritised.",
        ],
        bodyz: [
          "每个事件页都链接到对应的维基百科检索页，每张史料照片都链接到共享资源原始页。若日期、坐标、署名或许可有误，请提交 Issue 并附上页面 URL 与正确来源——纠错会被优先处理。",
        ],
      },
    ],
  },
];

export function getLegalDoc(slug: string): LegalDoc | null {
  return LEGAL_DOCS.find((d) => d.slug === slug) || null;
}
