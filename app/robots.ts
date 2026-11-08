import type { MetadataRoute } from "next";
import { getSiteOrigin } from "@/lib/site-url";

const base = getSiteOrigin();

/** 明确放行主流搜索与 AI 爬虫。
 *  哥飞分享的关键点之一：不要误把 AI 爬虫挡在 Cloudflare / robots 之外，
 *  ChatGPT 不看权重与 DR，只看页面描述与实际功能，新页面一样能拿到流量。 */
export default function robots(): MetadataRoute.Robots {
  const aiAgents = [
    "GPTBot",
    "OAI-SearchBot",
    "ChatGPT-User",
    "ClaudeBot",
    "Claude-Web",
    "anthropic-ai",
    "PerplexityBot",
    "Google-Extended",
    "Googlebot",
    "Bingbot",
    "CCBot",
    "Applebot-Extended",
    "cohere-ai",
    "YouBot",
  ];
  return {
    rules: [
      {
        userAgent: "*",
        // 公开只读 API 与 MCP 端点是给 AI 助手调用的，必须显式放行；
        // 其余 /api/ 内部接口（检查登录态、结账、抓取上游）继续屏蔽。
        // robots 规范按「最长匹配」判定，allow 比 disallow 更具体时优先生效。
        allow: ["/", "/api/public/"],
        disallow: ["/api/", "/dashboard", "/account", "/signin", "/signup"],
      },
      // 逐条显式声明，避免某些解析器的通配符规则覆盖 AI agent
      ...aiAgents.map((userAgent) => ({ userAgent, allow: "/" })),
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
