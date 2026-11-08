import { AccountSoon } from "@/components/AccountSoon";

// 原页面拉取 /api/account，在未启用账户体系的部署上返回 401 并显示
// 红字 "Failed to fetch purchases"。统一改为诚实的"账户即将开放"说明页。
export default function AccountPage() {
  return <AccountSoon />;
}
