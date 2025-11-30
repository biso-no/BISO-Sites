"use server";
import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import type { Orders, Users } from "@repo/api/types/appwrite";
import type { Locale } from "@repo/i18n/config";
import { getAvailableStock } from "@/app/actions/cart-reservations";
import { getLocale } from "@/app/actions/locale";
import { getProduct } from "@/app/actions/products";
import { validatePurchaseLimits } from "@/app/actions/purchase-limits";
import type { OrderItem } from "@/lib/types/order";
import { createVippsCheckout } from "@/lib/vipps";

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

async function getMemberDiscountIfAny(product: any) {
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
    const res = JSON.parse((exec as any).responseBody || "{}");
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

type CheckoutLineItemInput = {
  productId: string;
  slug: string;
  quantity: number;
  variationId?: string;
  customFields?: Record<string, string>;
  customFieldLabels?: Record<string, string>;
};

type CartCheckoutData = {
  items: CheckoutLineItemInput[];
  name: string;
  email: string;
  phone?: string;
};

type CheckoutResult = {
  success: boolean;
  paymentUrl?: string;
  orderId?: string;
  error?: string;
};

type CheckoutStatusResult = {
  success: boolean;
  order?: Orders;
  vippsStatus?: any;
  error?: string;
};

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
  cache: Map<string, any>
) {
  const cached = cache.get(productId);
  if (cached) {
    return cached;
  }
  const product = await getProduct(productId, locale);
  if (!product) {
    throw new Error(`Product ${productId} is not available anymore.`);
  }
  cache.set(productId, product);
  return product;
}

async function ensureStockAvailability(
  product: any,
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
  metadata: any
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

function findVariation(product: any, variationId?: string) {
  if (!variationId) {
    return;
  }
  return product.variations?.find((variant: any) => variant.id === variationId);
}

async function resolvePricing(
  product: any,
  variation: any,
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
  product: any,
  responses: Record<string, string>,
  labels?: Record<string, string>
) {
  if (!product.custom_fields) {
    return { responses: undefined, details: undefined };
  }

  const missingFields = product.custom_fields
    .filter((field: any) => field.required)
    .filter((field: any) => !responses[field.id])
    .map((field: any) => field.label);

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
  const productCache = new Map<string, any>();
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

    orderItems.push({
      product_id: product.$id,
      product_slug: product.slug,
      title: product.title || product.slug,
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

async function createCartCheckoutSession(
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
    const { db } = await createSessionClient();
    const order = await db.createRow("app", "orders", "unique()", {
      status: "pending",
      currency: "NOK",
      subtotal,
      discount_total: discountTotal,
      total: subtotal,
      buyer_name: data.name || "Guest",
      buyer_email: data.email || "",
      buyer_phone: data.phone || "",
      membership_applied: membershipApplied,
      member_discount_percent: membershipApplied ? maxDiscountPercent : 0,
      items_json: JSON.stringify(orderItems),
      campus_id: campusIds.size === 1 ? Array.from(campusIds)[0] : undefined,
    });

    const paymentDescription = orderItems
      .slice(0, 2)
      .map((item) => `${item.title} x ${item.quantity}`)
      .join(", ");

    const vippsCheckout = await createVippsCheckout({
      amount: Math.round(subtotal * 100),
      reference: order.$id,
      paymentDescription,
      email: data.email,
      firstName: data.name.split(" ")[0] || data.name,
      lastName: data.name.split(" ").slice(1).join(" ") || "",
      phoneNumber: data.phone || "",
      orderId: order.$id,
    });

    if (!vippsCheckout.ok) {
      console.error("Vipps checkout failed:", vippsCheckout);
      return {
        success: false,
        error: "Failed to create Vipps checkout session",
      };
    }

    await db.updateRow("app", "orders", order.$id, {
      vipps_session_id: vippsCheckout.data.token,
      vipps_payment_link: vippsCheckout.data.checkoutFrontendUrl,
    });

    return {
      success: true,
      paymentUrl: vippsCheckout.data.checkoutFrontendUrl,
      orderId: order.$id,
    };
  } catch (error) {
    console.error("Checkout session error", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Internal error",
    };
  }
}

async function _getCheckoutStatus(
  orderId: string
): Promise<CheckoutStatusResult> {
  try {
    const { db } = await createSessionClient();
    const order = await db.getRow<Orders>("app", "orders", orderId);

    if (!order.vipps_session_id) {
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
