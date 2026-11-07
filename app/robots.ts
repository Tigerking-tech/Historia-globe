import type { MetadataRoute } from "next";
import config from "@/config";

const base = `https://${config.domainName}`;

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
        allow: "/",
        disallow: ["/api/", "/dashboard", "/account", "/signin", "/signup"],
      },
      // 逐条显式声明，避免某些解析器的通配符规则覆盖 AI agent
      ...aiAgents.map((userAgent) => ({ userAgent, allow: "/" })),
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
