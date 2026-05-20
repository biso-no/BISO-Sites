"use server";
import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import type {
  ContentTranslations,
  Orders,
  Users,
} from "@repo/api/types/appwrite";
import type { Locale } from "@repo/i18n/config";
import { getAvailableStock } from "@/app/actions/cart-reservations";
import { getLocale } from "@/app/actions/locale";
import { getProduct } from "@/app/actions/products";
import { validatePurchaseLimits } from "@/app/actions/purchase-limits";
import type { OrderItem } from "@/lib/types/order";
import { parseProductMetadata } from "@/lib/types/webshop";

const WHITESPACE_RE = /\s+/;

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
    const orders = await db.listRows("app", "orders", query);
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

interface CheckoutStatusResult {
  error?: string;
  order?: Orders;
  success: boolean;
  vippsStatus?: unknown;
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
  cache: Map<string, Record<string, unknown>>
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
  const productMetadata =
    metadataParsed && typeof metadataParsed === "object"
      ? (metadataParsed as Record<string, unknown>)
      : {};

  const normalizedProduct = {
    ...product,
    title: translation?.title ?? product.slug,
    description: translation?.description ?? "",
    short_description: translation?.short_description ?? null,
    price: Number(product.regular_price ?? 0),
    metadata_parsed: metadataParsed,
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
  if (availableStock >= requestedQuantity) {
    return;
  }
  if (availableStock === 0) {
    throw new Error(`${product.title || slug || productId} is out of stock.`);
  }
  throw new Error(
    `Only ${availableStock} of ${product.title || slug || productId} available (${requestedQuantity} requested).`
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
  return (product.variations as Record<string, unknown>[])?.find(
    (variant) => variant.id === variationId
  );
}

async function resolvePricing(
  product: Record<string, unknown>,
  variation: Record<string, unknown> | undefined,
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

async function buildOrderItems(items: CheckoutLineItemInput[], locale: Locale) {
  const quantityByProduct = buildQuantityByProduct(items);
  const discountCache = new Map<
    string,
    { applied: boolean; percent: number }
  >();
  const productCache = new Map<string, Record<string, unknown>>();
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

    const userId = "guest";
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
  provider,
  payload,
}: {
  provider: PaymentProvider;
  payload: {
    userId: string;
    items: Array<{
      productId: string;
      name: string;
      price: number;
      quantity: number;
      title?: string;
      unit_price?: number;
      category?: string;
    }>;
    subtotal: number;
    discountTotal?: number;
    total: number;
    reference: string;
    currency: "NOK";
    membershipApplied?: boolean;
    memberDiscountPercent?: number;
    campusId?: string;
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

  const response = await fetch(
    `${apiBaseUrl}/api/payment/${provider}/checkout`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    }
  );

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
    const locale = await getLocale();
    const sanitizedItems = sanitizeCartItems(data.items);
    const {
      orderItems,
      subtotal,
      originalTotal,
      membershipApplied,
      maxDiscountPercent,
      campusIds,
    } = await buildOrderItems(sanitizedItems, locale);

    const discountTotal = Math.max(0, originalTotal - subtotal);
    const [firstName, ...lastNameParts] = data.name.trim().split(WHITESPACE_RE);
    const { checkoutUrl, orderId } = await createProviderCheckoutSession({
      provider: data.provider,
      payload: {
        userId: "guest",
        items: orderItems.map((item) => ({
          productId: item.product_id,
          name: item.title || item.product_slug || item.product_id,
          title: item.title,
          price: item.unit_price,
          unit_price: item.unit_price,
          quantity: item.quantity,
        })),
        subtotal,
        discountTotal: discountTotal || undefined,
        total: subtotal,
        reference: createCheckoutReference(),
        currency: "NOK",
        membershipApplied,
        memberDiscountPercent: membershipApplied
          ? maxDiscountPercent
          : undefined,
        campusId: campusIds.size === 1 ? Array.from(campusIds)[0] : undefined,
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
  if (!order?.payment_session_id) {
    return order;
  }
  const { getVippsSession } = await import("@repo/payment/vipps");
  const { updateOrderStatus } = await import(
    "@repo/shared/utils/vipps-order-ops"
  );
  try {
    const { paymentState, sessionData } = await getVippsSession(
      order.payment_session_id
    );
    await updateOrderStatus(orderId, paymentState, sessionData, db);
    return db.getRow<Orders>("app", "orders", orderId);
  } catch (error) {
    console.error("[verifyOrder] Failed to verify Vipps status:", error);
    return order;
  }
}

async function _getCheckoutStatus(
  orderId: string
): Promise<CheckoutStatusResult> {
  try {
    const { db } = await createSessionClient();
    const order = await db.getRow<Orders>("app", "orders", orderId);

    if (!order.payment_session_id) {
      return { success: false, error: "No Vipps session found" };
    }

    const { getVippsCheckout } = await import("@/lib/vipps");
    const vippsStatus = await getVippsCheckout(orderId);

    return {
      success: true,
      order,
      vippsStatus,
    };
  } catch (error) {
    console.error("Error getting checkout status:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to get checkout status",
    };
  }
}
