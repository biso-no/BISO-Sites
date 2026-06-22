import type { VippsCredentials } from "../credentials/types";
import { buildVippsClient } from "./client";
import type { CheckoutSessionParams, VippsPaymentState } from "./types";

interface VippsCheckoutData {
  checkoutFrontendUrl: string;
  token: string;
}

interface VippsSessionData {
  payment?: {
    aggregate?: {
      authorizedAmount?: {
        currency: string;
        value: number;
      };
    };
    state?: string;
  };
  sessionState?: string;
}

/** Redirect + webhook targets for a Vipps Checkout session. */
export interface VippsCheckoutUrls {
  /** Vipps webhook receiver — the `apps/api` callback route. */
  callbackUrl: string;
  /** Post-payment redirect — the `apps/web` checkout return route. */
  returnUrl: string;
}

/**
 * Creates a Vipps Checkout session.
 * Returns only the checkout URL and session ID — no DB operations.
 */
export async function createVippsCheckoutSession(
  params: CheckoutSessionParams & { orderId: string },
  creds: VippsCredentials,
  urls: VippsCheckoutUrls
): Promise<{ checkoutUrl: string; sessionId: string }> {
  const client = buildVippsClient(creds);

  const lineItems = params.items.map((item) => ({
    name: item.title || item.name,
    id: item.productId,
    totalAmount: Math.round(
      (item.unit_price ?? item.price) * item.quantity * 100
    ),
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

  const result = await client.checkout.create(
    creds.clientId,
    creds.clientSecret,
    {
      merchantInfo: {
        callbackUrl: urls.callbackUrl,
        returnUrl: urls.returnUrl,
        callbackAuthorizationToken: creds.callbackToken,
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
      prefillCustomer: {
        firstName: params.customerInfo?.firstName,
        lastName: params.customerInfo?.lastName,
        email: params.customerInfo?.email,
        phoneNumber: params.customerInfo?.phone,
        city: params.customerInfo?.city,
        postalCode: params.customerInfo?.postalCode,
        country: params.customerInfo?.country,
        streetAddress: params.customerInfo?.streetAddress,
      },
      type: "PAYMENT" as const,
    }
  );

  if (!result.ok) {
    throw new Error(
      `Vipps checkout creation failed: ${JSON.stringify(result)}`
    );
  }

  return {
    checkoutUrl: (result.data as VippsCheckoutData).checkoutFrontendUrl,
    sessionId: (result.data as VippsCheckoutData).token,
  };
}

/**
 * Fetches the current session state from Vipps.
 * Uses the resolved Vipps API credentials — no caller-supplied auth token
 * needed. No DB operations.
 */
export async function getVippsSession(
  sessionId: string,
  creds: VippsCredentials
): Promise<{
  paymentState: VippsPaymentState;
  sessionData: VippsSessionData;
}> {
  const client = buildVippsClient(creds);
  const result = await client.checkout.info(
    creds.clientId,
    creds.clientSecret,
    sessionId
  );

  if (!result.ok) {
    throw new Error(
      `Failed to get Vipps session info: ${JSON.stringify(result)}`
    );
  }

  const sessionData = result.data as VippsSessionData;
  const state =
    sessionData.sessionState || sessionData.payment?.state || "CREATED";

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
 * Validates the auth token Vipps sends with webhook callbacks against the
 * resolved callback token.
 */
export function verifyVippsCallbackToken(
  token: string,
  creds: VippsCredentials
): boolean {
  return token === creds.callbackToken;
}
