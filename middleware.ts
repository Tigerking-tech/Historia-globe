import { NextResponse } from "next/server";
import type { NextRequest, NextFetchEvent } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// 两件事：
//  1) 保留模板原有的 /dashboard 会话保护。
//  2) 记录 AI / 搜索爬虫命中（哥飞分享：GA 抓不到 AI 爬虫，要自己记），
//     转发到同源 /api/ingest 落盘 + 内存，供 /api/ingest?window=... 查询。
// middleware 跑在 Edge runtime，不能依赖 node:fs，因此 UA 表内联在此，
// 不 import observability.ts（那个文件顶部有 node:fs）。

const BOTS: [RegExp, string][] = [
  [/GPTBot/i, "GPTBot"],
  [/OAI-SearchBot/i, "OAI-SearchBot"],
  [/ChatGPT-User/i, "ChatGPT-User"],
  [/ClaudeBot|Claude-Web|anthropic-ai/i, "ClaudeBot"],
  [/PerplexityBot/i, "PerplexityBot"],
  [/Google-Extended/i, "Google-Extended"],
  [/Googlebot/i, "Googlebot"],
  [/Bingbot/i, "Bingbot"],
  [/CCBot/i, "CCBot"],
  [/Bytespider/i, "Bytespider"],
  [/cohere-ai/i, "Cohere"],
  [/YouBot/i, "YouBot"],
  [/Applebot-Extended/i, "Applebot-Extended"],
];

function botOf(ua: string | null): string | null {
  if (!ua) return null;
  for (const [re, name] of BOTS) if (re.test(ua)) return name;
  return null;
}

export function middleware(request: NextRequest, event: NextFetchEvent) {
  // (1) dashboard 保护：仅对该路径生效，不影响全站免费浏览。
  if (request.nextUrl.pathname.startsWith("/dashboard")) {
    const sessionCookie = getSessionCookie(request);
    if (!sessionCookie) {
      return NextResponse.redirect(new URL("/signin", request.url));
    }
  }

  const res = NextResponse.next();
  // (2) 爬虫命中记录，不阻塞响应。
  const ua = request.headers.get("user-agent");
  const bot = botOf(ua);
  if (bot) {
    res.headers.set("x-hg-bot", bot);
    const payload = JSON.stringify({
      step: "crawler_hit",
      bot,
      ua: (ua || "").slice(0, 400),
      path: request.nextUrl.pathname,
    });
    const ingest = new URL("/api/ingest", request.url);
    // build 期的静态生成也可能经过 middleware：必须给上报请求加硬超时，
    // 否则一个挂起的同源 fetch 会把 static worker 拖到 60s 超时。
    const send = () =>
      fetch(ingest, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: payload,
        signal: AbortSignal.timeout(2500),
      }).catch(() => undefined);
    try {
      event.waitUntil(send());
    } catch {
      // 某些运行时不提供 waitUntil：退化为不等待的尽力上报
      void send();
    }
  }
  return res;
}

export const config = {
  // 覆盖页面与内容页（含 dashboard），排除 API / Next 内部 / 带扩展名的静态资源，避免自触发循环。
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
