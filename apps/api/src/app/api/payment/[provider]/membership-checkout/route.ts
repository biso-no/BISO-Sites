import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import {
  type Memberships,
  type Orders,
  OrdersStatus,
  type Users,
} from "@repo/api/types/appwrite";
import {
  resolveStripeCredentials,
  resolveVippsCredentials,
} from "@repo/payment/credentials";
import { createStripeCheckoutSession } from "@repo/payment/stripe";
import { createVippsPayment } from "@repo/payment/vipps";
import { type CheckoutSessionParams, Currency } from "@repo/shared/types/vipps";
import { sanitizeStudentNumber } from "@repo/shared/utils/bi-student";
import { isFeatureEnabled } from "@repo/shared/utils/feature-flags-server";
import { CAMPUS_INVOICE_NAMES } from "@repo/shared/utils/finago-membership-invoice";
import { toMembershipPlan } from "@repo/shared/utils/membership-plans";
import { parseOrderItems } from "@repo/shared/utils/order-parsing";
import {
  createOrder,
  updateOrderWithSession,
} from "@repo/shared/utils/vipps-order-ops";
import { type NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/auth";
import { applyCorsHeaders, corsPreflightResponse } from "@/lib/cors";

type Provider = "vipps" | "stripe";

// The `bi_employee_id` column is pending an `appwrite push tables`; extend
// locally until packages/api/types/appwrite.ts is regenerated. Mirrors the
// pattern in apps/web/src/app/actions/membership-purchase.ts.
type BiUser = Users & { bi_employee_id?: string | null };

type CheckoutDb = Awaited<ReturnType<typeof createAdminClient>>["db"];

// The calling server action (apps/web/src/app/actions/membership-purchase.ts)
// aborts its fetch after 10s. If this endpoint had already created the order
// and payment session by then but was slow to respond, the caller sees a
// timeout and may retry — without a guard that retry would mint a second order
// and a second payment session for the same student and plan. The window is
// kept well past that 10s abort (15 min) so a genuine second purchase of the
// same plan later is never blocked.
const IDEMPOTENCY_WINDOW_MS = 15 * 60 * 1000;
const RECENT_ORDERS_LIMIT = 20;

type SessionOutcome =
  | {
      ok: true;
      orderId: string;
      session: { checkoutUrl: string; sessionId: string };
    }
  | { ok: false; message: string; status: number };

function isProvider(value: string): value is Provider {
  return value === "vipps" || value === "stripe";
}

function webBaseUrl(): string | undefined {
  // Return/success/cancel URLs must point at the WEB app's /api/checkout/return
  // route. In split-host deployments the api app has its own NEXT_PUBLIC_BASE_URL,
  // so prefer the web-specific var and only fall back to the shared one.
  return (
    process.env.NEXT_PUBLIC_WEB_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL
  );
}

interface MembershipCheckoutBody {
  campusId?: string;
  planId?: string;
}

function isValidBody(
  body: MembershipCheckoutBody | null
): body is Required<MembershipCheckoutBody> {
  return Boolean(body?.planId && body?.campusId);
}

/**
 * Finds a still-pending order this same buyer already created for this same
 * membership plan within the idempotency window and that already has a
 * stored checkout link, so a retried request reuses it instead of creating a
 * duplicate order + payment session. See IDEMPOTENCY_WINDOW_MS for why this
 * exists and how the window was chosen.
 */
async function findIdempotentOrder(
  db: CheckoutDb,
  userId: string,
  planId: string
): Promise<{ checkoutUrl: string; orderId: string } | null> {
  const windowStart = new Date(
    Date.now() - IDEMPOTENCY_WINDOW_MS
  ).toISOString();
  const recent = await db.listRows<Orders>("app", "orders", [
    Query.equal("userId", userId),
    Query.equal("status", OrdersStatus.PENDING),
    Query.greaterThan("$createdAt", windowStart),
    Query.orderDesc("$createdAt"),
    Query.limit(RECENT_ORDERS_LIMIT),
  ]);

  for (const order of recent.rows) {
    if (!order.payment_link) {
      continue;
    }
    const isSamePlan = parseOrderItems(order.items_json).some(
      (item) => item.product_type === "membership" && item.product_id === planId
    );
    if (isSamePlan) {
      return { checkoutUrl: order.payment_link, orderId: order.$id };
    }
  }

  return null;
}

// Resolve credentials before creating the order so a misconfigured provider
// doesn't leave an orphan PENDING order (matches the product checkout route).
async function startVippsMembershipCheckout(
  params: CheckoutSessionParams,
  db: CheckoutDb,
  webBase: string
): Promise<SessionOutcome> {
  const creds = await resolveVippsCredentials(db);
  if (!creds) {
    return { ok: false, message: "Vipps is not configured", status: 503 };
  }

  const { orderId } = await createOrder(params, db);
  const returnUrl = `${webBase}/api/checkout/return?orderId=${orderId}`;
  const payment = await createVippsPayment({ ...params, orderId }, creds, {
    returnUrl,
  });

  return {
    ok: true,
    orderId,
    session: {
      checkoutUrl: payment.checkoutUrl,
      sessionId: payment.reference,
    },
  };
}

async function startStripeMembershipCheckout(
  params: CheckoutSessionParams,
  db: CheckoutDb,
  webBase: string
): Promise<SessionOutcome> {
  const creds = await resolveStripeCredentials(db);
  if (!creds) {
    return { ok: false, message: "Stripe is not configured", status: 503 };
  }

  const { orderId } = await createOrder(params, db);
  const successUrl = `${webBase}/api/checkout/return?orderId=${orderId}`;
  const cancelUrl = `${webBase}/membership/join?cancelled=true`;
  const session = await createStripeCheckoutSession(
    { ...params, orderId },
    creds,
    { successUrl, cancelUrl }
  );

  return { ok: true, orderId, session };
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ provider: string }> }
) {
  const origin = req.headers.get("origin");
  const { provider } = await ctx.params;

  const json = (data: unknown, status = 200) =>
    applyCorsHeaders(NextResponse.json(data, { status }), origin);

  try {
    if (!isProvider(provider)) {
      return json({ message: "Unknown payment provider" }, 404);
    }

    if (!req.headers.get("authorization")?.startsWith("Bearer ")) {
      return json({ message: "Authentication required" }, 401);
    }
    const authClient = await createAuthenticatedClient(req);
    const user = await authClient.account.get().catch(() => null);
    if (!user?.$id) {
      return json({ message: "Authentication required" }, 401);
    }

    const flagKey = provider === "vipps" ? "payments_vipps" : "payments_stripe";
    if (!(await isFeatureEnabled(flagKey))) {
      return json(
        { message: `${provider} payment is currently unavailable` },
        403
      );
    }

    const webBase = webBaseUrl();
    if (!webBase) {
      return json({ message: "Payment service is misconfigured" }, 500);
    }

    const body = (await req
      .json()
      .catch(() => null)) as MembershipCheckoutBody | null;
    if (!isValidBody(body)) {
      return json({ message: "Invalid membership checkout payload" }, 400);
    }

    // `Object.hasOwn` guards against prototype-chain lookups (campusId ===
    // "constructor"/"toString"/"valueOf"/etc. resolving to an inherited
    // Object.prototype member instead of `undefined`) that a plain bracket
    // access on CAMPUS_INVOICE_NAMES would miss. This endpoint is reachable
    // directly with a valid JWT, so it re-validates rather than trusting the
    // caller — this is the same exploit already fixed in the calling server
    // action (apps/web/src/app/actions/membership-purchase.ts).
    if (!Object.hasOwn(CAMPUS_INVOICE_NAMES, body.campusId)) {
      return json({ message: "Invalid campus" }, 400);
    }

    const { db } = await createAdminClient();

    // Identity is re-verified server side; the web action's checks are UX, not
    // authorization. Without an employee id there is no Finago customer
    // number, so the purchase could not be fulfilled — refuse before payment.
    const profile = (await db
      .getRow<BiUser>("app", "user", user.$id)
      .catch(() => null)) as BiUser | null;
    const studentNumber = sanitizeStudentNumber(profile?.student_id);
    if (studentNumber === null) {
      return json({ message: "Link your BI student account first" }, 409);
    }
    if (!profile?.bi_employee_id) {
      return json({ message: "BI student record could not be verified" }, 409);
    }

    // Price and plan come from the database, never from the client.
    const row = await db
      .getRow<Memberships>("app", "memberships", body.planId)
      .catch(() => null);
    if (!(row?.status && row?.canPurchase)) {
      return json({ message: "That membership is no longer available" }, 409);
    }
    const plan = toMembershipPlan(row);
    if (!plan) {
      return json({ message: "That membership is not configured" }, 409);
    }

    // Idempotency: before creating anything, look for an order the caller
    // already started for this plan in the last 15 minutes and reuse it.
    const existing = await findIdempotentOrder(db, user.$id, plan.id);
    if (existing) {
      return json(existing);
    }

    const params: CheckoutSessionParams = {
      userId: user.$id,
      items: [
        {
          name: plan.name,
          title: plan.name,
          price: plan.price,
          unit_price: plan.price,
          productId: plan.id,
          quantity: 1,
          product_type: "membership",
          membership_id: String(plan.productId),
          category_id: String(plan.categoryId),
          duration: plan.duration,
          accrual_months: plan.accrualMonths,
        },
      ],
      subtotal: plan.price,
      total: plan.price,
      reference: `membership-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
      currency: Currency.NOK,
      campusId: body.campusId,
      customerInfo: {
        firstName: user.name?.split(" ")[0] || "Student",
        lastName: user.name?.split(" ").slice(1).join(" ") || "",
        email: user.email,
      },
    };

    const outcome =
      provider === "vipps"
        ? await startVippsMembershipCheckout(params, db, webBase)
        : await startStripeMembershipCheckout(params, db, webBase);

    if (!outcome.ok) {
      return json({ message: outcome.message }, outcome.status);
    }

    const { orderId, session } = outcome;
    await updateOrderWithSession(
      orderId,
      {
        provider,
        sessionId: session.sessionId,
        checkoutUrl: session.checkoutUrl,
      },
      db
    );

    return json({ checkoutUrl: session.checkoutUrl, orderId });
  } catch (error) {
    console.error(`[payment/${provider}/membership-checkout] error:`, error);
    return json({ message: "Failed to create checkout session" }, 500);
  }
}

export function OPTIONS(req: NextRequest) {
  return corsPreflightResponse(req.headers.get("origin"));
}
