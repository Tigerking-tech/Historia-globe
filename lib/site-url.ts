/**
 * 站点公开 URL 的唯一来源（Single Source of Truth）。
 *
 * 背景：此前 canonical / sitemap / robots / og:url / JSON-LD / llms.txt 全部把
 * "historiaglobe.com" 写死在 config.ts 里，而实际部署域名是 *.vercel.app，
 * 导致搜索引擎把整站判为「canonical 指向别处的副本」。
 *
 * 优先级（从高到低）：
 *   1. NEXT_PUBLIC_DOMAIN            显式绑定的自定义域（如 historiaglobe.com）
 *   2. NEXT_PUBLIC_SITE_URL          完整 origin，便于一次性覆盖
 *   3. VERCEL_PROJECT_PRODUCTION_URL Vercel 稳定的生产域，preview 构建也指向生产
 *   4. VERCEL_URL                    本次部署域（preview 会带 hash，仅作兜底）
 *   5. historiaglobe.com             本地 / 非 Vercel 环境的最终兜底
 *
 * 这样无需改代码即可切换：绑定自定义域后只在 Vercel 配 NEXT_PUBLIC_DOMAIN；
 * 不绑定时自动使用 Vercel 注入的生产域。Vercel 在 build 与 runtime 都会注入
 * 上述 VERCEL_* 变量，因此对 SSG 构建期固化的 metadata 同样生效。
 *
 * 注意：NEXT_PUBLIC_* 会进入客户端 bundle，VERCEL_* 仅服务端可见。
 * 需要客户端拼接绝对 URL 时请显式配置 NEXT_PUBLIC_DOMAIN。
 */

const FALLBACK_DOMAIN = "historiaglobe.com";

/** 去掉协议、路径、端口，只留主机名；空值返回 null。 */
function cleanHost(raw?: string | null): string | null {
  if (!raw) return null;
  let v = String(raw).trim();
  if (!v) return null;
  v = v.replace(/^https?:\/\//i, "").replace(/[/#?].*$/, "").replace(/:\d+$/, "");
  return v || null;
}

/** 纯主机名（不含协议），用于 config.domainName、og:image 等旧字段。 */
export function getSiteHost(): string {
  return (
    cleanHost(process.env.NEXT_PUBLIC_DOMAIN) ||
    cleanHost(process.env.NEXT_PUBLIC_SITE_URL) ||
    cleanHost(process.env.VERCEL_PROJECT_PRODUCTION_URL) ||
    cleanHost(process.env.VERCEL_URL) ||
    FALLBACK_DOMAIN
  );
}

/** 站点 origin，不含尾斜杠，如 https://historia-globe.vercel.app */
export function getSiteOrigin(): string {
  const isLocalDev =
    process.env.NODE_ENV === "development" &&
    !process.env.VERCEL_ENV &&
    !process.env.VERCEL_URL &&
    !process.env.VERCEL_PROJECT_PRODUCTION_URL &&
    !process.env.NEXT_PUBLIC_DOMAIN &&
    !process.env.NEXT_PUBLIC_SITE_URL;
  if (isLocalDev) return "http://localhost:3000";
  return `https://${getSiteHost()}`;
}

/** 拼接站内绝对路径，getSiteUrl("/sitemap.xml") */
export function getSiteUrl(path = "/"): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${getSiteOrigin()}${p}`;
}
