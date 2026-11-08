/** 结账入口：只创建「一次性小额包」的真实结账会话。
 *
 *  与模板遗留实现的差别：
 *  - 不再无条件 new Creem({serverIdx:1})（那是 test 环境，且没 key 时 500）
 *  - 收款未启用时返回明确的 503 + 原因码，绝不返回假的 checkout_url
 *  - 结算逻辑统一收敛到 lib/payments.ts 的状态机 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { createOneTimeCheckout, getPaymentConfig } from "@/lib/payments";
import { getProduct } from "@/lib/products";
import { getSiteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sku = req.nextUrl.searchParams.get("sku") || "archival-pass";
  const cfg = getPaymentConfig();

  // 先返回明确状态，避免用户拿到一个「看起来能付款」的死链。
  if (!cfg.canCheckout) {
    return NextResponse.json(
      {
        success: false,
        code: cfg.mode === "test" ? "test_mode_only" : "payments_disabled",
        message: cfg.reason,
        mode: cfg.mode,
      },
      { status: 503 }
    );
  }

  const product = getProduct(sku);
  if (!product || product.kind !== "one-time") {
    return NextResponse.json(
      { success: false, code: "unknown_product", message: `Unknown one-time product: ${sku}` },
      { status: 404 }
    );
  }

  const session = await auth.api.getSession({ headers: headers() });
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, code: "unauthorized", message: "Sign in to complete a purchase." },
      { status: 401 }
    );
  }

  const result = await createOneTimeCheckout({
    productSku: sku,
    userId: session.user.id,
    userEmail: session.user.email || undefined,
    successUrl: process.env.SUCCESS_URL || getSiteUrl("/account"),
  });

  if (!result.ok) {
    return NextResponse.json(
      { success: false, code: result.code, message: result.message, mode: result.mode },
      { status: result.code === "provider_error" ? 502 : 503 }
    );
  }
  return NextResponse.json({ success: true, checkoutUrl: result.url, mode: "live" });
}
