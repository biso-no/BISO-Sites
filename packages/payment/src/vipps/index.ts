import type {
  CheckoutSessionParams,
  VippsPaymentState,
} from "@repo/shared/types/vipps";
import { buildPrefillCustomer } from "@repo/shared/utils/vipps-pure";
import { client } from "./client";

const clientId = process.env.VIPPS_CLIENT_ID!;
const clientSecret = process.env.VIPPS_CLIENT_SECRET!;
const callbackToken = process.env.VIPPS_CALLBACK_TOKEN!;

/**
 * Creates a Vipps Checkout session.
 * Returns only the checkout URL and session ID — no DB operations.
 */
export async function createVippsCheckoutSession(
  params: CheckoutSessionParams & { orderId: string }
): Promise<{ checkoutUrl: string; sessionId: string }> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL!;

  const lineItems = params.items.map((item) => ({
    name: item.title || item.name,
    id: item.productId,
    totalAmount: Math.round((item.unit_price ?? item.price) * item.quantity * 100),
    totalAmountExcludingTax: Math.round(
      (item.unit_price ?? item.price) * item.quantity * 100
    ),
    totalTaxAmount: 0,
    taxRate: 0,
    unitInfo: {
      unitPrice: Math.round((item.unit_price ?? item.price) * 100),
      quantity: String(item.quantity),
      quantityUnit: "PCS" as const,
    },
  }));

  const prefillCustomer = buildPrefillCustomer(params.customerInfo);

  const result = await client.checkout.create(clientId, clientSecret, {
    merchantInfo: {
      callbackUrl: `${baseUrl}/api/payment/vipps/callback`,
      returnUrl: `${baseUrl}/api/checkout/return?orderId=${params.orderId}`,
      callbackAuthorizationToken: callbackToken,
    },
    transaction: {
      amount: {
        value: Math.round(params.total * 100),
        currency: params.currency,
      },
      reference: params.reference,
      paymentDescription: `Order ${params.orderId}`,
      orderSummary: {
        orderLines: lineItems,
        orderBottomLine: {
          tipAmount: 0,
          currency: params.currency,
        },
      },
    },
    type: "PAYMENT" as const,
    ...(prefillCustomer ? { prefillCustomer } : {}),
  });

  if (!result.ok) {
    throw new Error(
      `Vipps checkout creation failed: ${JSON.stringify(result)}`
    );
  }

  return {
    checkoutUrl: (result.data as any).checkoutFrontendUrl,
    sessionId: (result.data as any).token,
  };
}

/**
 * Fetches the current session state from Vipps.
 * Uses Vipps API credentials (env vars) — no caller-supplied auth token needed.
 * No DB operations.
 */
export async function getVippsSession(sessionId: string): Promise<{
  paymentState: VippsPaymentState;
  sessionData: any;
}> {
  const result = await client.checkout.info(clientId, clientSecret, sessionId);

  if (!result.ok) {
    throw new Error(
      `Failed to get Vipps session info: ${JSON.stringify(result)}`
    );
  }

  const sessionData = result.data as any;
  const state =
    sessionData.sessionState ||
    sessionData.payment?.state ||
    "CREATED";

  const paymentState: VippsPaymentState = {
    state: state as VippsPaymentState["state"],
    amount: sessionData.payment?.aggregate?.authorizedAmount
      ? {
          value: sessionData.payment.aggregate.authorizedAmount.value,
          currency: sessionData.payment.aggregate.authorizedAmount.currency,
        }
      : undefined,
  };

  return { paymentState, sessionData };
}

/**
 * Validates the auth token Vipps sends with webhook callbacks.
 */
export function verifyVippsCallbackToken(token: string): boolean {
  return token === callbackToken;
}
