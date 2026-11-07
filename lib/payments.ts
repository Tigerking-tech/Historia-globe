// 收款通道：可配置、可诊断、绝不假装。
//
// 背景：模板遗留的 checkout/products 无条件 new Creem({ serverIdx: 1 })，
// 那是 **test 环境**，且未配置凭证时 /api/products 直接 500。本模块把收款收敛成
// 一个显式状态机：
//   disabled      — 没有真实凭证；明确告知「支付尚未启用，本站不收款」
//   test          — 有 key 但模式为 test；只能走测试结账，绝不声称收到真钱
//   live          — 明确配置 live 模式 + 正式 key，才创建真实结账会话
//
// 这样既不会把测试通道误当成能收钱，也不会在没凭证时抛出 500。

export type PaymentMode = "disabled" | "test" | "live";

export type PaymentConfig = {
  mode: PaymentMode;
  provider: "creem";
  /** 面向用户与运维的诚实说明 */
  reason: string;
  /** 是否允许创建真实结账会话 */
  canCheckout: boolean;
  /** 是否对外展示价格（未启用时价格仍展示，但不出现「立即付款」的误导按钮） */
  pricesVisible: boolean;
};

export function getPaymentConfig(): PaymentConfig {
  const key = process.env.CREEM_API_KEY || "";
  const declared = (process.env.CREEM_MODE || "").toLowerCase();

  if (!key) {
    return {
      mode: "disabled",
      provider: "creem",
      reason: "No payment credentials configured. Checkout is disabled; this site collects no money today.",
      canCheckout: false,
      pricesVisible: true,
    };
  }
  if (declared === "live" || declared === "production") {
    return {
      mode: "live",
      provider: "creem",
      reason: "Live Creem credentials configured.",
      canCheckout: true,
      pricesVisible: true,
    };
  }
  return {
    mode: "test",
    provider: "creem",
    reason: "A Creem key exists but CREEM_MODE is not 'live'. Only test checkout is possible; no real charge will occur.",
    canCheckout: false,
    pricesVisible: true,
  };
}

export type CheckoutResult =
  | { ok: true; url: string; mode: "live" }
  | {
      ok: false;
      code: "payments_disabled" | "test_mode_only" | "provider_error" | "unauthorized" | "unknown_product";
      message: string;
      mode: PaymentMode;
    };

/** 创建一次性小额包结账会话。未启用真实收款时返回明确状态，绝不返回假 URL。 */
export async function createOneTimeCheckout(opts: {
  productSku: string;
  userId: string;
  userEmail?: string;
  successUrl: string;
}): Promise<CheckoutResult> {
  const cfg = getPaymentConfig();
  if (!cfg.canCheckout) {
    return {
      ok: false,
      code: cfg.mode === "test" ? "test_mode_only" : "payments_disabled",
      message: cfg.reason,
      mode: cfg.mode,
    };
  }

  try {
    // 仅在真实收款已启用时才加载 SDK，避免 test 环境下的隐式外呼。
    const { Creem } = await import("creem");
    const creem = new Creem({
      serverIdx: 0, // 0 = 正式环境；1 是遗留的 test 环境
      ...(process.env.CREEM_API_URL ? { serverURL: process.env.CREEM_API_URL } : {}),
    });
    const productId = process.env[`CREEM_PRODUCT_${opts.productSku.toUpperCase().replace(/-/g, "_")}`];
    if (!productId) {
      return {
        ok: false,
        code: "unknown_product",
        message: `No Creem product id mapped for ${opts.productSku}. Set CREEM_PRODUCT_<SKU>.`,
        mode: cfg.mode,
      };
    }
    const resp = await (creem as any).createCheckout({
      xApiKey: process.env.CREEM_API_KEY!,
      createCheckoutRequest: {
        productId,
        successUrl: opts.successUrl,
        requestId: opts.userId,
        metadata: { email: opts.userEmail || "", sku: opts.productSku, mode: "live" },
      },
    });
    const url = resp?.checkoutUrl;
    if (!url || typeof url !== "string") {
      return { ok: false, code: "provider_error", message: "Provider returned no checkout URL.", mode: cfg.mode };
    }
    return { ok: true, url, mode: "live" };
  } catch (e: any) {
    return {
      ok: false,
      code: "provider_error",
      message: String(e?.message || e).slice(0, 300),
      mode: cfg.mode,
    };
  }
}
