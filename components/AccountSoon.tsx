import Link from "next/link";

/**
 * 账户/会话统一说明页。
 * 收款与账户体系明确未启用，原先这些路由是未清理的 Creem 模板：
 * /account 因 /api/account 返回 401 而显示红字 "Failed to fetch purchases"，
 * 外层的 "Creem Template Dashboard v1.0.0" 黑底终端壳也是模板残留。
 * 现在统一收敛为一个诚实、友好的说明页：全站免费、无需账户即可使用。
 * 纯服务端组件，无客户端状态、不发起任何请求。
 */
export function AccountSoon() {
  return (
    <div className="relative min-h-[70vh] bg-[#04101f] text-slate-200">
      <div className="mx-auto flex max-w-xl flex-col items-center px-5 py-24 text-center">
        <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-sky-400/80">
          Historia Globe · Account
        </span>

        <h1 className="editorial mt-6 text-3xl text-white sm:text-4xl">
          Accounts are coming soon
        </h1>
        <p className="mt-3 text-sm text-slate-400">账户功能即将开放</p>

        <div className="mt-8 space-y-4 text-left text-sm leading-relaxed text-slate-300">
          <p>
            Historia Globe is <strong className="text-white">free and needs no account</strong>{" "}
            today. The interactive globe, all 366 date pages, event and place pages, the archival
            slideshow, Ask Historia, CSV export and the public API / MCP endpoint are open to
            everyone — no sign-up, no card.
          </p>
          <p>
            Accounts, saved places and the optional paid pass are on the roadmap but are not
            enabled yet. Nothing on this site requires a login, and we do not collect your email.
          </p>
          <p className="text-slate-400">
            本站目前全站免费、无需账户：地球、366 个日期页、事件与地点页、史料幻灯片、AI 问答、CSV 导出与公开 API / MCP 均可直接使用。
            账户、收藏地点与可选付费通行证仍在路线图上，尚未启用；本站不收集邮箱。
          </p>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/explore"
            className="rounded-md bg-sky-500 px-5 py-2.5 text-sm font-semibold text-[#04101f] transition hover:bg-sky-400"
          >
            Open the globe · 打开地球
          </Link>
          <Link
            href="/"
            className="rounded-md border border-white/15 px-5 py-2.5 text-sm text-slate-200 transition hover:bg-white/5"
          >
            Back home · 返回首页
          </Link>
        </div>
      </div>
    </div>
  );
}
