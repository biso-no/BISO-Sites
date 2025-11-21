"use server";
import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import type { Orders, Users } from "@repo/api/types/appwrite";
import { getAvailableStock } from "@/app/actions/cart-reservations";
import { getLocale } from "@/app/actions/locale";
import { getProduct } from "@/app/actions/products";
import { validatePurchaseLimits } from "@/app/actions/purchase-limits";
import { Order, type OrderItem } from "@/lib/types/order";
import { createVippsCheckout } from "@/lib/vipps";

async function getOrders({
  limit = 100,
  userId = "",
  status = "",
  path = "/admin/shop/orders",
}: {
  limit?: number;
  offset?: number;
  search?: string;
  userId?: string;
  status?: string;
  path?: string;
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

async function getOrder(id: string) {
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
    if (!product?.member_discount_enabled || !product?.member_discount_percent)
      return { applied: false, percent: 0 };
    const { account, db, functions } = await createSessionClient();
    const user = await account.get().catch(() => null);
    if (!user?.$id) return { applied: false, percent: 0 };
    const profile = await db.getRow<Users>("app", "user", user.$id);
    const studentId = profile?.studentId?.student_id;
    if (!studentId) return { applied: false, percent: 0 };
    const exec = await functions.createExecution(
      "verify_biso_membership",
      String(studentId),
      false
    );
    const res = JSON.parse((exec as any).responseBody || "{}");
    const isActive = !!res?.membership?.status;
    if (!isActive) return { applied: false, percent: 0 };
    return {
      applied: true,
      percent: Number(product.member_discount_percent) || 0,
    };
  } catch {
    return { applied: false, percent: 0 };
  }
}

export interface CheckoutLineItemInput {
  productId: string;
  slug: string;
  quantity: number;
  variationId?: string;
  customFields?: Record<string, string>;
  customFieldLabels?: Record<string, string>;
}

export interface CartCheckoutData {
  items: CheckoutLineItemInput[];
  name: string;
  email: string;
  phone?: string;
}

export interface CheckoutResult {
  success: boolean;
  paymentUrl?: string;
  orderId?: string;
  error?: string;
}

export interface CheckoutStatusResult {
  success: boolean;
  order?: Orders;
  vippsStatus?: any;
  error?: string;
}

function normalizeCustomFields(inputs?: Record<string, string>) {
  if (!inputs) return {};
  return Object.entries(inputs).reduce<Record<string, string>>(
    (acc, [key, value]) => {
      if (typeof value !== "string") return acc;
      const trimmed = value.trim();
      if (trimmed.length === 0) return acc;
      acc[key] = trimmed;
      return acc;
    },
    {}
  );
}

export async function createCartCheckoutSession(
  data: CartCheckoutData
): Promise<CheckoutResult> {
  try {
    if (!data.items || data.items.length === 0) {
      throw new Error("Your cart is empty");
    }

    const locale = await getLocale();
    const sanitizedItems = data.items
      .map((item) => ({
        ...item,
        quantity: Math.max(1, Math.floor(Number(item.quantity) || 0)),
      }))
      .filter((item) => item.quantity > 0 && item.productId);

    if (sanitizedItems.length === 0) {
      throw new Error("No valid items in cart");
    }

    const quantityByProduct = new Map<string, number>();
    for (const item of sanitizedItems) {
      quantityByProduct.set(
        item.productId,
        (quantityByProduct.get(item.productId) || 0) + item.quantity
      );
    }

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

    for (const input of sanitizedItems) {
      const productId = input.productId;
      if (!productId) continue;

      let product = productCache.get(productId);
      if (!product) {
        product = await getProduct(productId, locale);
        if (!product) {
          throw new Error(
            `Product ${input.slug || productId} is not available anymore.`
          );
        }
        productCache.set(productId, product);
      }

      if (!product.price) {
        throw new Error(
          `Product ${product.title || product.slug} is missing a price.`
        );
      }

      const totalForProduct = quantityByProduct.get(productId) || 0;

      // Check available stock (considering reservations)
      if (product.stock !== null && product.stock !== undefined) {
        const availableStock = await getAvailableStock(productId);
        if (availableStock < totalForProduct) {
          throw new Error(
            availableStock === 0
              ? `${product.title || product.slug} is out of stock.`
              : `Only ${availableStock} of ${product.title || product.slug} available (${totalForProduct} requested).`
          );
        }
      }

      // Validate purchase limits
      // Try to get userId from session, fallback to 'guest' for now
      // Note: For proper per-user limit enforcement, pass userId through CartCheckoutData
      const userId = "guest"; // TODO: Get from session when user auth is implemented
      const limitCheck = await validatePurchaseLimits(
        productId,
        userId,
        totalForProduct,
        product.metadata_parsed
      );

      if (!limitCheck.allowed) {
        throw new Error(
          limitCheck.reason ||
            `Purchase limit exceeded for ${product.title || product.slug}`
        );
      }

      const variation = product.variations?.find(
        (variant: any) => variant.id === input.variationId
      );
      const basePrice = Number(product.price || 0);
      const variationModifier = Number(variation?.price_modifier || 0);
      const originalUnit = Math.max(0, basePrice + variationModifier);

      const discount =
        discountCache.get(productId) || (await getMemberDiscountIfAny(product));
      discountCache.set(productId, discount);

      const discountedUnit = discount.applied
        ? Math.max(0, originalUnit * (1 - discount.percent / 100))
        : originalUnit;

      membershipApplied = membershipApplied || discount.applied;
      maxDiscountPercent = discount.applied
        ? Math.max(maxDiscountPercent, discount.percent || 0)
        : maxDiscountPercent;

      const customFieldResponses = normalizeCustomFields(input.customFields);
      const customFieldLabels = input.customFieldLabels || {};
      if (product.custom_fields) {
        const missingFields = product.custom_fields
          .filter((field: any) => field.required)
          .filter((field: any) => !customFieldResponses[field.id])
          .map((field: any) => field.label);
        if (missingFields.length > 0) {
          throw new Error(
            `Missing required information for ${product.title || product.slug}: ${missingFields.join(", ")}`
          );
        }
      }

      const customFieldDetails = Object.entries(customFieldResponses).map(
        ([fieldId, value]) => ({
          id: fieldId,
          label: customFieldLabels[fieldId] || fieldId,
          value,
        })
      );

      orderItems.push({
        product_id: product.$id,
        product_slug: product.slug,
        title: product.title || product.slug,
        unit_price: discountedUnit,
        quantity: input.quantity,
        variation_id: variation?.id,
        variation_name: variation?.name,
        variation_price: variationModifier,
        custom_field_responses: Object.keys(customFieldResponses).length
          ? customFieldResponses
          : undefined,
        custom_fields: customFieldDetails.length
          ? customFieldDetails
          : undefined,
      });

      subtotal += discountedUnit * input.quantity;
      originalTotal += originalUnit * input.quantity;
      if (product.campus_id) {
        campusIds.add(product.campus_id);
      }
    }

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

export async function startCartCheckout(data: CartCheckoutData) {
  return createCartCheckoutSession(data);
}

async function getCheckoutStatus(
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
