import { NextResponse } from "next/server";
import { getPaymentConfig } from "@/lib/payments";
import { sellableProducts } from "@/lib/products";

export const dynamic = "force-dynamic";

/** 商品目录：返回本地真实定义，不再无条件调用 Creem test 环境导致 500。
 *  未配置正式凭证时明确 enabled:false，不把测试通道当作在售商品。
 *  模板遗留实现（new Creem({serverIdx:1}) + searchProducts）在未配置 key 时
 *  会抛出 SDK 异常并返回 500，已整体替换。 */
export async function GET() {
  const cfg = getPaymentConfig();
  return NextResponse.json({
    enabled: cfg.canCheckout,
    mode: cfg.mode,
    reason: cfg.reason,
    items: sellableProducts().map((p) => ({
      sku: p.sku,
      name: p.name,
      nameZh: p.nameZh,
      kind: p.kind,
      priceUsd: p.priceUsd,
      description: p.description,
      features: p.features,
      sellable: p.sellable && cfg.canCheckout,
    })),
  });
}
