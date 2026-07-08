import { createAdminClient } from "@repo/api/server";
import type {
  ContentTranslations,
  Users,
  WebshopProducts,
} from "@repo/api/types/appwrite";
import {
  resolveStripeCredentials,
  resolveVippsCredentials,
} from "@repo/payment/credentials";
import { createStripeCheckoutSession } from "@repo/payment/stripe";
import { createVippsPayment } from "@repo/payment/vipps";
import { type CheckoutSessionParams, Currency } from "@repo/shared/types/vipps";
import { isFeatureEnabled } from "@repo/shared/utils/feature-flags-server";
import {
  createOrder,
  updateOrderWithSession,
} from "@repo/shared/utils/vipps-order-ops";
import { type NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/auth";
import { applyCorsHeaders, corsPreflightResponse } from "@/lib/cors";

type Provider = "vipps" | "stripe";
const DEFAULT_VIPPS_CHECKOUT_TIMEOUT_MS = 10_000;

interface CheckoutBody {
  currency: "NOK";
  customerInfo: {
    firstName?: string;
    lastName?: string;
    email: string;
    phone?: string;
  };
  items: CheckoutLineItemInput[];
  reference: string;
  subtotal: number;
  total: number;
}

interface CheckoutLineItemInput {
  customFieldLabels?: Record<string, string>;
  customFields?: Record<string, string>;
  productId: string;
  quantity: number;
  slug?: string;
  title?: string;
  variationId?: string;
}

interface ProductVariation {
  id?: string;
  name?: string;
  price_modifier?: number;
}

interface NormalizedProduct extends WebshopProducts {
  metadata_parsed: Record<string, unknown>;
  title: string;
  variations?: ProductVariation[];
}

type CheckoutDb = Awaited<ReturnType<typeof createAdminClient>>["db"];
type AuthenticatedClient = Awaited<
  ReturnType<typeof createAuthenticatedClient>
>;

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

function isValidBody(body: CheckoutBody | null): body is CheckoutBody {
  return Boolean(
    body &&
      body.currency === "NOK" &&
      Array.isArray(body.items) &&
      body.items.length > 0 &&
      typeof body.total === "number" &&
      Number.isFinite(body.total) &&
      body.reference &&
      body.customerInfo?.email
  );
}

type SessionOutcome =
  | {
      ok: true;
      orderId: string;
      session: { checkoutUrl: string; sessionId: string };
    }
  | { ok: false; message: string; status: number };

class CheckoutTimeoutError extends Error {}

function readPositiveInteger(
  value: string | undefined,
  fallback: number
): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function vippsCheckoutTimeoutMs(): number {
  return readPositiveInteger(
    process.env.VIPPS_CHECKOUT_TIMEOUT_MS,
    DEFAULT_VIPPS_CHECKOUT_TIMEOUT_MS
  );
}

async function withDeadline<T>(
  work: Promise<T>,
  timeoutMs: number,
  message: string
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new CheckoutTimeoutError(message));
    }, timeoutMs);
    timeout.unref?.();
  });

  try {
    return await Promise.race([work, deadline]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function hasBearerToken(req: NextRequest): boolean {
  return req.headers.get("authorization")?.startsWith("Bearer ") ?? false;
}

async function authenticateCheckout(req: NextRequest) {
  if (!hasBearerToken(req)) {
    return null;
  }
  try {
    const client = await createAuthenticatedClient(req);
    const user = await client.account.get();
    return user?.$id ? { client, userId: user.$id } : null;
  } catch {
    return null;
  }
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

// biome-ignore lint/suspicious/noControlCharactersInRegex: intentionally strip control chars from a client-supplied display title
const CONTROL_CHARS_RE = /[\u0000-\u001f\u007f]/g;
const REPEATED_WHITESPACE_RE = /\s+/g;
const MAX_ITEM_TITLE_LENGTH = 300;

/**
 * The web checkout folds the buyer's selected options into the line `title`
 * (via `buildCheckoutLineTitle`) — it does not send them as structured
 * variation/custom-field data — so the trusted rebuild must keep that title or
 * the order confirmation/fulfillment view loses the option choices. The title
 * is display-only (the price is still recomputed server-side), so trusting it
 * carries no price risk; we still normalize control chars/whitespace and cap
 * the length to keep it a safe display string, falling back to the canonical
 * product title when the client sends nothing usable.
 */
function sanitizeItemTitle(raw: string | undefined, fallback: string): string {
  if (typeof raw !== "string") {
    return fallback;
  }
  const cleaned = raw
    .replace(CONTROL_CHARS_RE, " ")
    .replace(REPEATED_WHITESPACE_RE, " ")
    .trim();
  if (!cleaned) {
    return fallback;
  }
  return cleaned.length > MAX_ITEM_TITLE_LENGTH
    ? cleaned.slice(0, MAX_ITEM_TITLE_LENGTH)
    : cleaned;
}

function sanitizeCartItems(items: CheckoutLineItemInput[]) {
  return items
    .map((item) => ({
      ...item,
      quantity: Math.max(1, Math.floor(Number(item.quantity) || 0)),
    }))
    .filter((item) => item.productId && item.quantity > 0);
}

function parseProductMetadata(metadataString: string | null | undefined) {
  if (!metadataString) {
    return {};
  }
  try {
    const parsed = JSON.parse(metadataString);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function productTitle(product: WebshopProducts) {
  const translation = Array.isArray(product.translation_refs)
    ? (product.translation_refs.find(
        (item): item is ContentTranslations =>
          typeof item === "object" && item !== null && "title" in item
      ) ?? null)
    : null;
  return translation?.title ?? product.slug;
}

async function loadProduct(
  productId: string,
  db: CheckoutDb,
  cache: Map<string, NormalizedProduct>
) {
  const cached = cache.get(productId);
  if (cached) {
    return cached;
  }

  const product = await db.getRow<WebshopProducts>(
    getRequiredEnv("APPWRITE_DATABASE_ID"),
    getRequiredEnv("APPWRITE_WEBSHOP_PRODUCTS_COLLECTION_ID"),
    productId
  );
  const metadataParsed = parseProductMetadata(product.metadata);
  const normalizedProduct: NormalizedProduct = {
    ...product,
    metadata_parsed: metadataParsed,
    title: productTitle(product),
    variations: Array.isArray(metadataParsed.variations)
      ? (metadataParsed.variations as ProductVariation[])
      : undefined,
  };
  cache.set(productId, normalizedProduct);
  return normalizedProduct;
}

function findVariation(product: NormalizedProduct, variationId?: string) {
  if (!variationId) {
    return;
  }
  return product.variations?.find((variant) => variant.id === variationId);
}

async function getMemberDiscountIfAny(
  product: NormalizedProduct,
  authClient: AuthenticatedClient,
  userId: string
) {
  if (
    !(
      product.metadata_parsed.member_discount_enabled &&
      product.metadata_parsed.member_discount_percent
    )
  ) {
    return { applied: false, percent: 0 };
  }

  try {
    const profile = await authClient.db.getRow<Users>("app", "user", userId);
    const studentId = profile?.studentId?.student_id;
    if (!studentId) {
      return { applied: false, percent: 0 };
    }

    const exec = await authClient.functions.createExecution(
      "verify_biso_membership",
      String(studentId),
      false
    );
    const res = JSON.parse(
      (exec as { responseBody?: string }).responseBody || "{}"
    );
    const isActive = Boolean(res?.membership?.status);
    if (!isActive) {
      return { applied: false, percent: 0 };
    }

    return {
      applied: true,
      percent: Number(product.metadata_parsed.member_discount_percent) || 0,
    };
  } catch {
    return { applied: false, percent: 0 };
  }
}

async function resolvePricing(
  product: NormalizedProduct,
  variation: ProductVariation | undefined,
  discountCache: Map<string, { applied: boolean; percent: number }>,
  authClient: AuthenticatedClient,
  userId: string
) {
  const basePrice = Number(product.regular_price || 0);
  const variationModifier = Number(variation?.price_modifier || 0);
  const originalUnit = Math.max(0, basePrice + variationModifier);
  const discount =
    discountCache.get(product.$id) ||
    (await getMemberDiscountIfAny(product, authClient, userId));
  discountCache.set(product.$id, discount);

  const discountedUnit = discount.applied
    ? Math.max(0, originalUnit * (1 - discount.percent / 100))
    : originalUnit;

  return {
    discountApplied: discount.applied,
    discountPercent: discount.percent || 0,
    discountedUnit,
    originalUnit,
  };
}

async function buildTrustedCheckoutParams({
  authClient,
  body,
  db,
  userId,
}: {
  authClient: AuthenticatedClient;
  body: CheckoutBody;
  db: CheckoutDb;
  userId: string;
}): Promise<CheckoutSessionParams> {
  const sanitizedItems = sanitizeCartItems(body.items);
  if (sanitizedItems.length === 0) {
    throw new Error("Invalid checkout payload");
  }

  const productCache = new Map<string, NormalizedProduct>();
  const discountCache = new Map<
    string,
    { applied: boolean; percent: number }
  >();
  const trustedItems: CheckoutSessionParams["items"] = [];
  const campusIds = new Set<string>();

  let subtotal = 0;
  let originalTotal = 0;
  let membershipApplied = false;
  let maxDiscountPercent = 0;

  for (const input of sanitizedItems) {
    const product = await loadProduct(input.productId, db, productCache);
    if (!Number(product.regular_price)) {
      throw new Error(
        `Product ${product.title || product.slug} is missing a price.`
      );
    }
    const variation = findVariation(product, input.variationId);
    const pricing = await resolvePricing(
      product,
      variation,
      discountCache,
      authClient,
      userId
    );

    const productName = product.title || product.slug || product.$id;

    trustedItems.push({
      name: productName,
      price: pricing.discountedUnit,
      productId: product.$id,
      quantity: input.quantity,
      // The web checkout conveys the buyer's selected options only by folding
      // them into the line title, so keep that (sanitized) title for the
      // receipt/fulfillment view instead of overwriting it with the bare
      // product name. It is display-only; the price is recomputed above.
      title: sanitizeItemTitle(input.title, productName),
      unit_price: pricing.discountedUnit,
      // Preserve the buyer's selections for the receipt/fulfillment. These are
      // non-price data — the price above is still recomputed server-side — so
      // carrying them through does not weaken the trusted-amount guarantee.
      variationId: input.variationId,
      variationName: variation?.name,
      customFields: input.customFields,
      customFieldLabels: input.customFieldLabels,
    });

    subtotal += pricing.discountedUnit * input.quantity;
    originalTotal += pricing.originalUnit * input.quantity;
    if (product.campus_id) {
      campusIds.add(product.campus_id);
    }
    if (pricing.discountApplied) {
      membershipApplied = true;
      maxDiscountPercent = Math.max(
        maxDiscountPercent,
        pricing.discountPercent
      );
    }
  }

  const discountTotal = Math.max(0, originalTotal - subtotal);
  return {
    userId,
    items: trustedItems,
    subtotal,
    discountTotal: discountTotal || undefined,
    total: subtotal,
    reference: body.reference,
    currency: Currency.NOK,
    membershipApplied,
    memberDiscountPercent: membershipApplied ? maxDiscountPercent : undefined,
    campusId: campusIds.size === 1 ? Array.from(campusIds)[0] : undefined,
    customerInfo: body.customerInfo,
  };
}

function totalsMatch(clientTotal: number, serverTotal: number): boolean {
  return Math.round(clientTotal * 100) === Math.round(serverTotal * 100);
}

// Resolve credentials before creating the order so a misconfigured provider
// doesn't leave an orphan PENDING order.
async function startVippsCheckout(
  params: CheckoutSessionParams,
  db: CheckoutDb,
  webBase: string
): Promise<SessionOutcome> {
  const creds = await resolveVippsCredentials(db);
  if (!creds) {
    return { ok: false, message: "Vipps is not configured", status: 503 };
  }

  const { orderId, order } = await createOrder(params, db);
  // The ePayment `reference` is the order id; the redirect target is the web
  // return route. The amount is taken from the persisted order total.
  const returnUrl = `${webBase}/api/checkout/return?orderId=${orderId}`;
  const payment = await withDeadline(
    createVippsPayment(
      { ...params, total: order.total ?? params.total, orderId },
      creds,
      { returnUrl }
    ),
    vippsCheckoutTimeoutMs(),
    "Vipps checkout timed out"
  );

  return {
    ok: true,
    orderId,
    session: { checkoutUrl: payment.checkoutUrl, sessionId: payment.reference },
  };
}

async function startStripeCheckout(
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
  const cancelUrl = `${webBase}/shop/cart?cancelled=true`;
  // Same deadline discipline as the Vipps branch — a stalled Stripe call must
  // surface as a 504 instead of hanging the checkout request.
  const session = await withDeadline(
    createStripeCheckoutSession({ ...params, orderId }, creds, {
      successUrl,
      cancelUrl,
    }),
    vippsCheckoutTimeoutMs(),
    "Stripe checkout timed out"
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

    const auth = await authenticateCheckout(req);
    if (!auth) {
      return json({ message: "Authentication required" }, 401);
    }

    // Availability kill switch (Phase A/B). Separate from credential config.
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

    const body = (await req.json().catch(() => null)) as CheckoutBody | null;
    if (!isValidBody(body)) {
      return json({ message: "Invalid checkout payload" }, 400);
    }

    const { db } = await createAdminClient();
    const params = await buildTrustedCheckoutParams({
      authClient: auth.client,
      body,
      db,
      userId: auth.userId,
    });
    if (!totalsMatch(body.total, params.total)) {
      return json({ message: "Checkout total mismatch" }, 400);
    }

    const outcome =
      provider === "vipps"
        ? await startVippsCheckout(params, db, webBase)
        : await startStripeCheckout(params, db, webBase);

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
    if (error instanceof CheckoutTimeoutError) {
      return json({ message: error.message }, 504);
    }

    console.error(`[payment/${provider}/checkout] error:`, error);
    return json({ message: "Failed to create checkout session" }, 500);
  }
}

export function OPTIONS(req: NextRequest) {
  return corsPreflightResponse(req.headers.get("origin"));
}
