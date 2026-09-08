import { Query } from "@repo/api";
import type { createAdminClient } from "@repo/api/server";
import type {
  CartReservations,
  ContentTranslations,
  Orders,
  Users,
  WebshopProducts,
} from "@repo/api/types/appwrite";
import { type CheckoutSessionParams, Currency } from "@repo/shared/types/vipps";
import { sanitizeStudentNumber } from "@repo/shared/utils/bi-student";
import { computeMembershipStatus } from "@repo/shared/utils/membership-status";
import { ORDER_ITEMS_SELECT } from "@repo/shared/utils/order-queries";
import {
  checkMaxPerOrder,
  evaluatePerUserLimit,
  summarizePurchases,
} from "@repo/shared/utils/purchase-limits";
import {
  computeAvailableStock,
  sumReservedQuantity,
} from "@repo/shared/utils/stock-availability";
import type { createAuthenticatedClient } from "@/lib/auth";

/**
 * The trusted checkout pricing pipeline, shared by the checkout route (which
 * turns the result into an order plus a payment session) and the quote route
 * (which returns it so a buyer — notably the mobile app, which has no server
 * of its own — can show the price they will actually be charged).
 *
 * Everything that decides money is recomputed here from stored rows; the client
 * only names products, variations and quantities. Titles and custom-field
 * answers ride along as display/fulfilment data and never affect the amount.
 */

export interface CheckoutLineItemInput {
  customFieldLabels?: Record<string, string>;
  customFields?: Record<string, string>;
  productId: string;
  quantity: number;
  slug?: string;
  title?: string;
  variationId?: string;
}

export interface CheckoutCustomerInfo {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

interface ProductVariation {
  id?: string;
  name?: string;
  price_modifier?: number;
}

export interface NormalizedProduct extends Omit<WebshopProducts, "variations"> {
  metadata_parsed: Record<string, unknown>;
  title: string;
  variations: ProductVariation[];
}

export type CheckoutDb = Awaited<ReturnType<typeof createAdminClient>>["db"];
export type AuthenticatedClient = Awaited<
  ReturnType<typeof createAuthenticatedClient>
>;

/**
 * Thrown when a line fails stock-availability or purchase-limit validation.
 * Carries the HTTP status to surface to the client (409 = conflict / oversell).
 */
export class CheckoutValidationError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const ORDER_STATUS_FILTER = Query.or([
  Query.equal("status", "authorized"),
  Query.equal("status", "paid"),
]);

export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

// Validate a single product line against current stock and purchase limits
// BEFORE any order/payment session is created, so a direct POST with an
// oversized quantity cannot oversell or bypass per-user limits. Fails closed.
export async function ensureLineAvailability({
  product,
  requestedQuantity,
  userId,
  db,
}: {
  product: NormalizedProduct;
  requestedQuantity: number;
  userId: string;
  db: CheckoutDb;
}): Promise<void> {
  const productName = product.title || product.slug || product.$id;

  // Stock check (fail closed): only enforced when the product tracks stock.
  // Available stock must account for OTHER buyers' active cart reservations,
  // exactly like the web path (`getAvailableStock` in cart-reservations.ts) —
  // otherwise a direct POST could buy units currently held in someone else's
  // cart as long as requested <= raw product.stock, forcing an oversell once
  // the payment settles. `db` here is the admin client, so it sees every
  // user's reservation rows (which are row-secured to their creator).
  if (product.stock !== null && product.stock !== undefined) {
    const now = new Date().toISOString();
    const reservations = await db.listRows<CartReservations>(
      "app",
      "cart_reservations",
      [
        Query.equal("product_id", product.$id),
        Query.greaterThan("expires_at", now),
        Query.select(["quantity", "user_id"]),
        Query.limit(1000),
      ]
    );

    const totalReserved = sumReservedQuantity(reservations.rows);
    // Add the caller's own hold back so their cart items don't block their
    // own checkout (mirrors the web `effectiveAvailable` calculation).
    const callerHold =
      userId && userId !== "guest"
        ? sumReservedQuantity(
            reservations.rows.filter((row) => row.user_id === userId)
          )
        : 0;
    const availableForCaller =
      computeAvailableStock(product.stock, totalReserved) + callerHold;

    if (requestedQuantity > availableForCaller) {
      throw new CheckoutValidationError(
        availableForCaller <= 0
          ? `${productName} is out of stock.`
          : `Only ${availableForCaller} of ${productName} available (${requestedQuantity} requested).`,
        409
      );
    }
  }

  // Per-order and per-user purchase limits live in the product metadata.
  const metadata = product.metadata_parsed;
  const maxPerOrder =
    typeof metadata.max_per_order === "number"
      ? metadata.max_per_order
      : undefined;
  const maxPerUser =
    typeof metadata.max_per_user === "number"
      ? metadata.max_per_user
      : undefined;

  const perOrder = checkMaxPerOrder(requestedQuantity, maxPerOrder);
  if (!perOrder.allowed) {
    throw new CheckoutValidationError(
      perOrder.reason || `Purchase limit exceeded for ${productName}`,
      409
    );
  }

  if (maxPerUser && maxPerUser > 0 && userId && userId !== "guest") {
    const orders = await db.listRows<Orders>("app", "orders", [
      Query.equal("userId", userId),
      ORDER_STATUS_FILTER,
      ORDER_ITEMS_SELECT,
      Query.limit(1000),
    ]);
    const { totalPurchased } = summarizePurchases(orders.rows, product.$id);
    const perUser = evaluatePerUserLimit(
      totalPurchased,
      requestedQuantity,
      maxPerUser
    );
    if (!perUser.allowed) {
      throw new CheckoutValidationError(
        perUser.reason || `Purchase limit exceeded for ${productName}`,
        409
      );
    }
  }
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
export function sanitizeItemTitle(
  raw: string | undefined,
  fallback: string
): string {
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

export function sanitizeCartItems(items: CheckoutLineItemInput[]) {
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

export async function loadProduct(
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
    productId,
    [Query.select(["*", "variations.*"])]
  );
  const metadataParsed = parseProductMetadata(product.metadata);
  const normalizedProduct: NormalizedProduct = {
    ...product,
    metadata_parsed: metadataParsed,
    title: productTitle(product),
    variations: (product.variations ?? [])
      .filter((variation) => variation.enabled)
      .map((variation) => ({
        id: variation.$id,
        name: variation.name,
        price_modifier:
          Number(variation.regular_price ?? product.regular_price) -
          Number(product.regular_price),
      })),
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
    const studentNumber = sanitizeStudentNumber(profile?.student_id);
    if (studentNumber === null) {
      return { applied: false, percent: 0 };
    }

    const status = await computeMembershipStatus(studentNumber);
    if (!status.isMember) {
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

/**
 * Rebuilds the checkout from stored product rows: prices, member discount,
 * stock and purchase limits are all resolved server-side. Throws
 * {@link CheckoutValidationError} when a line cannot be fulfilled.
 */
export async function buildTrustedCheckoutParams({
  authClient,
  customerInfo,
  db,
  items,
  reference,
  userId,
}: {
  authClient: AuthenticatedClient;
  customerInfo?: CheckoutCustomerInfo;
  db: CheckoutDb;
  items: CheckoutLineItemInput[];
  reference: string;
  userId: string;
}): Promise<CheckoutSessionParams> {
  const sanitizedItems = sanitizeCartItems(items);
  if (sanitizedItems.length === 0) {
    throw new Error("Invalid checkout payload");
  }

  // Aggregate requested quantity per product so stock/limit checks see the full
  // amount a buyer is trying to purchase across multiple (e.g. per-variation)
  // line items, not each line in isolation.
  const quantityByProduct = new Map<string, number>();
  for (const item of sanitizedItems) {
    quantityByProduct.set(
      item.productId,
      (quantityByProduct.get(item.productId) || 0) + item.quantity
    );
  }
  const validatedProducts = new Set<string>();

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
    // Validate availability + purchase limits once per product (fail closed)
    // before any order or payment session is created.
    if (!validatedProducts.has(product.$id)) {
      await ensureLineAvailability({
        product,
        requestedQuantity: quantityByProduct.get(input.productId) || 0,
        userId,
        db,
      });
      validatedProducts.add(product.$id);
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
      // Snapshotted so a later refund reverses the account this sale actually
      // credited, even if the product's account is edited in between.
      finago_account_number: product.finago_account_number ?? null,
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
    reference,
    currency: Currency.NOK,
    membershipApplied,
    memberDiscountPercent: membershipApplied ? maxDiscountPercent : undefined,
    campusId: campusIds.size === 1 ? Array.from(campusIds)[0] : undefined,
    customerInfo,
  };
}

/**
 * The shape the quote route returns: exactly the amounts the checkout route
 * would charge for the same cart, per line and in total. Clients render this
 * instead of computing prices themselves, so a client can never disagree with
 * the server's total (which checkout rejects with a 400).
 */
export interface CheckoutQuoteLine {
  customFields?: Record<string, string>;
  lineTotal: number;
  name: string;
  productId: string;
  quantity: number;
  title: string;
  unitPrice: number;
  variationId?: string;
  variationName?: string;
}

export interface CheckoutQuote {
  currency: "NOK";
  discountTotal: number;
  items: CheckoutQuoteLine[];
  memberDiscountPercent: number;
  membershipApplied: boolean;
  subtotal: number;
  total: number;
}

/** Projects trusted checkout params into the client-facing quote shape. */
export function toCheckoutQuote(params: CheckoutSessionParams): CheckoutQuote {
  return {
    currency: "NOK",
    discountTotal: params.discountTotal ?? 0,
    items: params.items.map((item) => ({
      customFields: item.customFields,
      lineTotal: Number(item.unit_price ?? item.price ?? 0) * item.quantity,
      name: item.name,
      productId: item.productId,
      quantity: item.quantity,
      title: item.title ?? item.name,
      unitPrice: Number(item.unit_price ?? item.price ?? 0),
      variationId: item.variationId,
      variationName: item.variationName,
    })),
    memberDiscountPercent: params.memberDiscountPercent ?? 0,
    membershipApplied: Boolean(params.membershipApplied),
    subtotal: params.subtotal,
    total: params.total,
  };
}
