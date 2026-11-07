import { NextResponse } from "next/server";
import { getPaymentConfig } from "@/lib/payments";
import { sellableProducts } from "@/lib/products";

export const dynamic = "force-dynamic";

/** 定价页与浏览器验证都从这里读真实状态，避免前端写死「已上线」。 */
export async function GET() {
  const config = getPaymentConfig();
  return NextResponse.json({
    ...config,
    products: sellableProducts().map((p) => ({
      sku: p.sku,
      name: p.name,
      nameZh: p.nameZh,
      kind: p.kind,
      priceUsd: p.priceUsd,
    })),
  });
}
