"use server";
import { Query } from "@repo/api";
import { createAdminClient, createSessionClient } from "@repo/api/server";
import type {
  ContentTranslations,
  Orders,
  Users,
} from "@repo/api/types/appwrite";
import type { Locale } from "@repo/i18n/config";
import { getFeatureFlagStates } from "@repo/shared/utils/feature-flags-server";
import { getAvailableStock, getUserReservation } from "@/app/actions/cart-reservations";
import { getLocale } from "@/app/actions/locale";
import { getProduct } from "@/app/actions/products";
import { validatePurchaseLimits } from "@/app/actions/purchase-limits";
import type { OrderItem } from "@/lib/types/order";
import { parseProductMetadata } from "@/lib/types/webshop";

const WHITESPACE_RE = /\s+/;
const DEFAULT_CHECKOUT_FETCH_TIMEOUT_MS = 10_000;

async function _getOrders({
  limit = 100,
  userId = "",
  status = "",
}: {
  limit?: number;
  offset?: number;
  search?: string;
  userId?: string;
  status?: string;
}) {
  const { db } = await createSessionClient();
  try {
    const query = [Query.limit(limit)];
    if (userId) {
      query.push(Query.equal("userId", userId));
    }
    if (status) {
      query.push(Query.equal("status", status));
    }
    query.push(Query.orderDesc("$createdAt"));
    const orders = await db.listRows<Orders>("app", "orders", query);
    return orders.rows;
  } catch (error) {
    console.error("Error fetching orders:", error);
    return [];
  }
}

async function _getOrder(id: string) {
  const { db } = await createSessionClient();
  try {
    const order = await db.getRow<Orders>("app", "orders", id);
    return order;
  } catch (error) {
    console.error("Error fetching order:", error);
    return null;
  }
}

async function getMemberDiscountIfAny(product: Record<string, unknown>) {
  try {
    if (
      !(product?.member_discount_enabled && product?.member_discount_percent)
    ) {
      return { applied: false, percent: 0 };
    }
    const { account, db, functions } = await createSessionClient();
    const user = await account.get().catch(() => null);
    if (!user?.$id) {
      return { applied: false, percent: 0 };
    }
    const profile = await db.getRow<Users>("app", "user", user.$id);
    const studentId = profile?.studentId?.student_id;
    if (!studentId) {
      return { applied: false, percent: 0 };
    }
    const exec = await functions.createExecution(
      "verify_biso_membership",
      String(studentId),
      false
    );
    const res = JSON.parse(
      (exec as { responseBody?: string }).responseBody || "{}"
    );
    const isActive = !!res?.membership?.status;
    if (!isActive) {
      return { applied: false, percent: 0 };
    }
    return {
      applied: true,
      percent: Number(product.member_discount_percent) || 0,
    };
  } catch {
    return { applied: false, percent: 0 };
  }
}

interface CheckoutLineItemInput {
  customFieldLabels?: Record<string, string>;
  customFields?: Record<string, string>;
  productId: string;
  quantity: number;
  slug: string;
  title?: string;
  variationId?: string;
}

interface ProductVariation {
  id?: string;
  name?: string;
  price_modifier?: number;
}

interface NormalizedProduct extends Record<string, unknown> {
  $id: string;
  campus_id?: string | null;
  custom_fields?: Record<string, unknown>[];
  metadata_parsed: Record<string, unknown>;
  price: number;
  slug: string;
  title: string;
  variations?: ProductVariation[];
}

type PaymentProvider = "vipps" | "stripe";

interface CartCheckoutData {
  email: string;
  items: CheckoutLineItemInput[];
  name: string;
  phone?: string;
  provider: PaymentProvider;
}

interface CheckoutResult {
  error?: string;
  orderId?: string;
  paymentUrl?: string;
  success: boolean;
}

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

function checkoutFetchTimeoutMs(): number {
  return readPositiveInteger(
    process.env.CHECKOUT_FETCH_TIMEOUT_MS,
    DEFAULT_CHECKOUT_FETCH_TIMEOUT_MS
  );
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  );
}

function sanitizeCartItems(items: CheckoutLineItemInput[] | undefined) {
  if (!items || items.length === 0) {
    throw new Error("Your cart is empty");
  }

  const sanitized = items
    .map((item) => ({
      ...item,
      quantity: Math.max(1, Math.floor(Number(item.quantity) || 0)),
    }))
    .filter((item) => item.quantity > 0 && item.productId);

  if (sanitized.length === 0) {
    throw new Error("No valid items in cart");
  }

  return sanitized;
}

function buildQuantityByProduct(items: CheckoutLineItemInput[]) {
  return items.reduce<Map<string, number>>((map, item) => {
    map.set(item.productId, (map.get(item.productId) || 0) + item.quantity);
    return map;
  }, new Map());
}

async function loadProduct(
  productId: string,
  locale: Locale,
  cache: Map<string, NormalizedProduct>
) {
  const cached = cache.get(productId);
  if (cached) {
    return cached;
  }
  const product = await getProduct(productId, locale);
  if (!product) {
    throw new Error(`Product ${productId} is not available anymore.`);
  }

  const translation = Array.isArray(product.translation_refs)
    ? (product.translation_refs.find(
        (item): item is ContentTranslations =>
          typeof item === "object" && item !== null && item.locale === locale
      ) ??
      product.translation_refs.find(
        (item): item is ContentTranslations =>
          typeof item === "object" && item !== null && "title" in item
      ))
    : null;

  const metadataParsed = parseProductMetadata(product.metadata);
  const productMetadata: Record<string, unknown> =
    metadataParsed && typeof metadataParsed === "object"
      ? (metadataParsed as Record<string, unknown>)
      : {};

  const normalizedProduct: NormalizedProduct = {
    ...product,
    title: translation?.title ?? product.slug,
    description: translation?.description ?? "",
    short_description: translation?.short_description ?? null,
    price: Number(product.regular_price ?? 0),
    metadata_parsed: productMetadata,
    custom_fields: Array.isArray(productMetadata.custom_fields)
      ? productMetadata.custom_fields
      : undefined,
    variations: Array.isArray(productMetadata.variations)
      ? productMetadata.variations
      : undefined,
    member_discount_enabled: Boolean(productMetadata.member_discount_enabled),
    member_discount_percent: Number(
      productMetadata.member_discount_percent || 0
    ),
  };

  cache.set(productId, normalizedProduct);
  return normalizedProduct;
}

async function ensureStockAvailability(
  product: Record<string, unknown>,
  productId: string,
  requestedQuantity: number,
  slug?: string
) {
  if (product.stock === null || product.stock === undefined) {
    return;
  }
  const availableStock = await getAvailableStock(productId);
  
  // The buyer's own active hold is already subtracted from availableStock.
  // Add it back so their own cart items don't block their checkout.
  const myHold = await getUserReservation(productId);
  const effectiveAvailable = availableStock + (myHold?.quantity || 0);

  if (effectiveAvailable >= requestedQuantity) {
    return;
  }
  if (effectiveAvailable === 0) {
    throw new Error(`${product.title || slug || productId} is out of stock.`);
  }
  throw new Error(
    `Only ${effectiveAvailable} of ${product.title || slug || productId} available (${requestedQuantity} requested).`
  );
}

async function ensurePurchaseLimit(
  productId: string,
  userId: string,
  quantity: number,
  metadata: Record<string, unknown>
) {
  const limitCheck = await validatePurchaseLimits(
    productId,
    userId,
    quantity,
    metadata
  );
  if (limitCheck.allowed) {
    return;
  }
  throw new Error(
    limitCheck.reason || `Purchase limit exceeded for ${productId}`
  );
}

function findVariation(product: Record<string, unknown>, variationId?: string) {
  if (!variationId) {
    return;
  }
  return (product.variations as ProductVariation[] | undefined)?.find(
    (variant) => variant.id === variationId
  );
}

async function resolvePricing(
  product: Record<string, unknown>,
  variation: ProductVariation | undefined,
  discountCache: Map<string, { applied: boolean; percent: number }>,
  productId: string
) {
  const basePrice = Number(product.price || 0);
  const variationModifier = Number(variation?.price_modifier || 0);
  const originalUnit = Math.max(0, basePrice + variationModifier);

  const discount =
    discountCache.get(productId) || (await getMemberDiscountIfAny(product));
  discountCache.set(productId, discount);

  const discountedUnit = discount.applied
    ? Math.max(0, originalUnit * (1 - discount.percent / 100))
    : originalUnit;

  return {
    originalUnit,
    discountedUnit,
    discountApplied: discount.applied,
    discountPercent: discount.percent || 0,
    variationModifier,
  };
}

function buildCustomFieldPayload(
  product: Record<string, unknown>,
  responses: Record<string, string>,
  labels?: Record<string, string>
) {
  if (!product.custom_fields) {
    return { responses: undefined, details: undefined };
  }

  const missingFields = (product.custom_fields as Record<string, unknown>[])
    .filter((field) => field.required)
    .filter((field) => !responses[field.id as string])
    .map((field) => field.label);

  if (missingFields.length > 0) {
    throw new Error(
      `Missing required information for ${product.title || product.slug}: ${missingFields.join(", ")}`
    );
  }

  const details = Object.entries(responses).map(([fieldId, value]) => ({
    id: fieldId,
    label: labels?.[fieldId] || fieldId,
    value,
  }));

  return {
    responses: Object.keys(responses).length ? responses : undefined,
    details: details.length ? details : undefined,
  };
}

function pushCampusId(campusIds: Set<string>, campusId?: string | null) {
  if (campusId) {
    campusIds.add(campusId);
  }
}

async function buildOrderItems(
  items: CheckoutLineItemInput[],
  locale: Locale,
  userId: string
) {
  const quantityByProduct = buildQuantityByProduct(items);
  const discountCache = new Map<
    string,
    { applied: boolean; percent: number }
  >();
  const productCache = new Map<string, NormalizedProduct>();
  const orderItems: OrderItem[] = [];
  const campusIds = new Set<string>();

  let subtotal = 0;
  let originalTotal = 0;
  let membershipApplied = false;
  let maxDiscountPercent = 0;

  for (const input of items) {
    const productId = input.productId;
    if (!productId) {
      continue;
    }

    const product = await loadProduct(productId, locale, productCache);
    if (!product.price) {
      throw new Error(
        `Product ${product.title || product.slug} is missing a price.`
      );
    }

    const requestedQuantity = quantityByProduct.get(productId) || 0;
    await ensureStockAvailability(
      product,
      productId,
      requestedQuantity,
      input.slug
    );

    await ensurePurchaseLimit(
      productId,
      userId,
      requestedQuantity,
      product.metadata_parsed
    );

    const variation = findVariation(product, input.variationId);
    const pricing = await resolvePricing(
      product,
      variation,
      discountCache,
      productId
    );
    const customFieldResponses = normalizeCustomFields(input.customFields);
    const customFields = buildCustomFieldPayload(
      product,
      customFieldResponses,
      input.customFieldLabels
    );
    const title = input.title?.trim() || product.title || product.slug;

    orderItems.push({
      product_id: product.$id,
      product_slug: product.slug,
      title,
      unit_price: pricing.discountedUnit,
      quantity: input.quantity,
      variation_id: variation?.id,
      variation_name: variation?.name,
      variation_price: pricing.variationModifier,
      custom_field_responses: customFields.responses,
      custom_fields: customFields.details,
    });

    subtotal += pricing.discountedUnit * input.quantity;
    originalTotal += pricing.originalUnit * input.quantity;
    pushCampusId(campusIds, product.campus_id);

    if (pricing.discountApplied) {
      membershipApplied = true;
      maxDiscountPercent = Math.max(
        maxDiscountPercent,
        pricing.discountPercent
      );
    }
  }

  return {
    orderItems,
    subtotal,
    originalTotal,
    membershipApplied,
    maxDiscountPercent,
    campusIds,
  };
}

function normalizeCustomFields(inputs?: Record<string, string>) {
  if (!inputs) {
    return {};
  }
  return Object.entries(inputs).reduce<Record<string, string>>(
    (acc, [key, value]) => {
      if (typeof value !== "string") {
        return acc;
      }
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        return acc;
      }
      acc[key] = trimmed;
      return acc;
    },
    {}
  );
}

function createCheckoutReference() {
  return `checkout-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
}

async function createProviderCheckoutSession({
  jwt,
  provider,
  payload,
}: {
  jwt: string;
  provider: PaymentProvider;
  payload: {
    items: CheckoutLineItemInput[];
    subtotal: number;
    total: number;
    reference: string;
    currency: "NOK";
    customerInfo: {
      firstName?: string;
      lastName?: string;
      email: string;
      phone?: string;
    };
  };
}): Promise<{ checkoutUrl: string; orderId: string }> {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  if (!apiBaseUrl) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, checkoutFetchTimeoutMs());
  timeout.unref?.();

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}/api/payment/${provider}/checkout`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new CheckoutTimeoutError(
        "Checkout request timed out. Please try again."
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const result = await response.json().catch(() => null);

  if (!(response.ok && result?.checkoutUrl && result?.orderId)) {
    throw new Error(
      result?.message ||
        `Failed to create ${provider === "vipps" ? "Vipps" : "Stripe"} checkout session`
    );
  }

  return {
    checkoutUrl: result.checkoutUrl as string,
    orderId: result.orderId as string,
  };
}

export async function createCartCheckoutSession(
  data: CartCheckoutData
): Promise<CheckoutResult> {
  try {
    // Kill switch: a payment provider can be disabled platform-wide.
    const flags = await getFeatureFlagStates();
    const providerEnabled =
      data.provider === "vipps" ? flags.payments_vipps : flags.payments_stripe;
    if (!providerEnabled) {
      return {
        success: false,
        error: `${data.provider === "vipps" ? "Vipps" : "Card"} payment is currently unavailable.`,
      };
    }

    const locale = await getLocale();
    const sanitizedItems = sanitizeCartItems(data.items);

    // Resolve the buyer's identity from the Appwrite session. Anonymous
    // sessions (no email, no real name) still have a $id we can use for
    // per-user purchase-limit enforcement and JWT-authenticated API checkout.
    const { account } = await createSessionClient();
    const user = await account.get().catch(() => null);
    if (!user?.$id) {
      throw new Error("A valid checkout session is required.");
    }
    const jwt = await account.createJWT().catch(() => null);
    if (!jwt?.jwt) {
      throw new Error("A valid checkout session is required.");
    }
    const userId = user.$id;

    const { subtotal } = await buildOrderItems(sanitizedItems, locale, userId);

    const [firstName, ...lastNameParts] = data.name.trim().split(WHITESPACE_RE);
    const { checkoutUrl, orderId } = await createProviderCheckoutSession({
      jwt: jwt.jwt,
      provider: data.provider,
      payload: {
        items: sanitizedItems,
        subtotal,
        total: subtotal,
        reference: createCheckoutReference(),
        currency: "NOK",
        customerInfo: {
          firstName: firstName || data.name.trim() || "Guest",
          lastName: lastNameParts.join(" "),
          email: data.email,
          phone: data.phone || undefined,
        },
      },
    });

    return {
      success: true,
      paymentUrl: checkoutUrl,
      orderId,
    };
  } catch (error) {
    console.error("Checkout session error", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Internal error",
    };
  }
}

export async function getOrder(id: string) {
  return await _getOrder(id);
}

export async function verifyOrder(orderId: string) {
  const { db } = await createSessionClient();
  const order = await db.getRow<Orders>("app", "orders", orderId);
  if (!(order?.payment_session_id && order.payment_provider)) {
    return order;
  }

  try {
    // Status writes go through the admin client: orders are Operations-Unit
    // writable and the buyer's (possibly anonymous) session cannot update them.
    const { db: adminDb } = await createAdminClient();

    if (order.payment_provider === "vipps") {
      const { reconcileVippsPayment } = await import("@repo/payment/vipps");
      await reconcileVippsPayment(orderId, adminDb);
    } else if (order.payment_provider === "stripe") {
      const { resolveStripeCredentials } = await import(
        "@repo/payment/credentials"
      );
      const { getStripeSession } = await import("@repo/payment/stripe");
      const { determineStatusFromStripeSession } = await import(
        "@repo/shared/utils/stripe-pure"
      );
      const { applyOrderStatusTransition } = await import(
        "@repo/shared/utils/vipps-order-ops"
      );
      const creds = await resolveStripeCredentials(adminDb);
      if (creds) {
        const { session } = await getStripeSession(
          order.payment_session_id,
          creds
        );
        const { status, updateData } =
          determineStatusFromStripeSession(session);
        await applyOrderStatusTransition(orderId, status, updateData, adminDb);
      }
    }

    return await db.getRow<Orders>("app", "orders", orderId);
  } catch (error) {
    console.error("[verifyOrder] Failed to verify payment status:", error);
    return order;
  }
}
