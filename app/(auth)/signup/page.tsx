import type { Metadata } from "next";
import { AccountSoon } from "@/components/AccountSoon";

// 原为模板的终端风格注册表单（依赖 better-auth + dev.db，Vercel 上不可用）。
// 收款与账户体系明确未启用，收敛为统一的"账户即将开放"说明页。
export const metadata: Metadata = {
  title: "Account · Historia Globe",
  robots: { index: false, follow: false },
};

export default function SignupPage() {
  return <AccountSoon />;
}
