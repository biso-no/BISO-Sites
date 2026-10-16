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
import type { RevenueTarget } from "@repo/shared/utils/finago-shop-accounting";
import { resolveRevenueTarget } from "@repo/shared/utils/finago-shop-accounting-server";
import {
  memberDiscountPercent,
  memberUnitPrice,
} from "@repo/shared/utils/member-discount";
import { computeMembershipStatus } from "@repo/shared/utils/membership-status";
import { ORDER_ITEMS_SELECT } from "@repo/shared/utils/order-queries";
import {
  type ProductCustomField,
  type ProductCustomFieldRow,
  resolveCustomFieldAnswers,
  toProductCustomFields,
} from "@repo/shared/utils/product-custom-fields";
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
  member_price?: number | null;
  name?: string;
  price_modifier?: number;
}

export interface NormalizedProduct
  extends Omit<WebshopProducts, "custom_fields" | "variations"> {
  custom_fields: ProductCustomField[];
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

/** The only `webshop_products.status` a buyer may transact against. */
const PUBLISHED_STATUS = "published";

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

/**
 * Members-only gate, fail closed.
 *
 * `member_only` restricts who may BUY a product, not who may see it — every
 * public surface lists it and marks it with a badge — so this is the only thing
 * standing between a non-member and the purchase. It belongs on this trusted
 * path, shared by `/checkout` and `/checkout/quote`, because the storefront's
 * disabled button is bypassed by posting straight to the API.
 *
 * An error from the membership lookup propagates instead of counting as "not a
 * member", so a 24SevenOffice outage fails the checkout rather than telling a
 * paying member they are not one.
 */
async function ensureMemberOnlyAllowed(
  product: NormalizedProduct,
  productName: string,
  isMember: () => Promise<boolean>
): Promise<void> {
  if (product.member_only && !(await isMember())) {
    throw new CheckoutValidationError(
      `${productName} is available to BISO members only.`,
      403
    );
  }
}

// Validate a single product line against current stock and purchase limits
// BEFORE any order/payment session is created, so a direct POST with an
// oversized quantity cannot oversell or bypass per-user limits. Fails closed.
export async function ensureLineAvailability({
  product,
  requestedQuantity,
  userId,
  db,
  isMember,
}: {
  product: NormalizedProduct;
  requestedQuantity: number;
  userId: string;
  db: CheckoutDb;
  isMember: () => Promise<boolean>;
}): Promise<void> {
  const productName = product.title || product.slug || product.$id;

  await ensureMemberOnlyAllowed(product, productName, isMember);

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
    // The checkout questions are needed here, not just on the product page:
    // this is where the buyer's answers are validated against them.
    [Query.select(["*", "variations.*", "custom_fields.*"])]
  );

  // Only a published product can be bought, and this is the chokepoint that
  // decides it: `db` is the admin client and `webshop_products` grants read to
  // `any`, so a draft, pending-approval or archived product is fetched here
  // perfectly happily. Both trusted entry points — `/api/payment/<provider>/
  // checkout` and `/api/payment/checkout/quote` — come through this function,
  // so a buyer who knows or guesses an unpublished product's id cannot price it
  // or pay for it. A draft is a product that has never been offered for sale;
  // it is reported as unavailable rather than as a validation failure.
  if (product.status !== PUBLISHED_STATUS) {
    throw new CheckoutValidationError(
      `${productTitle(product) || productId} is not available for purchase.`,
      404
    );
  }
  const metadataParsed = parseProductMetadata(product.metadata);
  const normalizedProduct: NormalizedProduct = {
    ...product,
    custom_fields: toProductCustomFields(
      (product as { custom_fields?: ProductCustomFieldRow[] }).custom_fields
    ),
    metadata_parsed: metadataParsed,
    title: productTitle(product),
    variations: (product.variations ?? [])
      .filter((variation) => variation.enabled)
      .map((variation) => ({
        id: variation.$id,
        member_price: variation.member_price,
        name: variation.name,
        price_modifier:
          Number(variation.regular_price ?? product.regular_price) -
          Number(product.regular_price),
      })),
  };
  cache.set(productId, normalizedProduct);
  return normalizedProduct;
}

/**
 * The buyer's answers, reconciled against the questions the product actually
 * asks — see `resolveCustomFieldAnswers` for why none of it is taken on trust.
 */
function validatedAnswers(
  product: NormalizedProduct,
  responses: Record<string, string> | undefined,
  productName: string
) {
  const answers = resolveCustomFieldAnswers(product.custom_fields, responses);
  if (answers.missing.length > 0) {
    // 400 rather than 409: nothing is contended, the request is simply
    // incomplete, and the buyer has to supply the answer rather than retry.
    throw new CheckoutValidationError(
      `Missing required information for ${productName}: ${answers.missing.join(", ")}`,
      400
    );
  }
  return answers;
}

function findVariation(product: NormalizedProduct, variationId?: string) {
  if (!variationId) {
    return;
  }
  return product.variations?.find((variant) => variant.id === variationId);
}

function isRowNotFound(error: unknown): boolean {
  return (error as { code?: number } | null)?.code === 404;
}

/**
 * Whether the buyer is an active member, resolved at most once per checkout and
 * shared by the two features that need it: the `member_only` purchase gate and
 * the member discount.
 *
 * Two failure modes, deliberately told apart:
 *
 * - No profile row, or a profile with no usable student number, is a definite
 *   answer: this buyer is not a member. `getRow` *throws* a 404 rather than
 *   returning null, so that has to be caught here — letting it escape turned a
 *   plain "you are not a member" into a 500 with no reason attached.
 * - A failing membership lookup is not an answer at all, so the error
 *   propagates. The two callers then diverge as they should: the gate fails
 *   closed on it, while the member discount catches it and charges full price.
 */
export function createMembershipResolver(
  authClient: AuthenticatedClient,
  userId: string
): () => Promise<boolean> {
  let pending: Promise<boolean> | null = null;

  async function resolve(): Promise<boolean> {
    if (!userId || userId === "guest") {
      return false;
    }
    let studentId: string | null | undefined;
    try {
      const profile = await authClient.db.getRow<Users>("app", "user", userId);
      studentId = profile?.student_id;
    } catch (error) {
      if (!isRowNotFound(error)) {
        throw error;
      }
      return false;
    }
    const studentNumber = sanitizeStudentNumber(studentId);
    if (studentNumber === null) {
      return false;
    }
    const status = await computeMembershipStatus(studentNumber);
    return status.isMember;
  }

  return () => {
    if (!pending) {
      pending = resolve();
    }
    return pending;
  };
}

/**
 * Whether the member price applies to this buyer. Fails open: a membership
 * lookup outage charges full price rather than blocking the sale.
 */
async function isMemberOrFullPrice(
  isMember: () => Promise<boolean>
): Promise<boolean> {
  try {
    return await isMember();
  } catch {
    return false;
  }
}

async function resolvePricing(
  product: NormalizedProduct,
  variation: ProductVariation | undefined,
  isMember: () => Promise<boolean>
) {
  const basePrice = Number(product.regular_price || 0);
  const variationModifier = Number(variation?.price_modifier || 0);
  const originalUnit = Math.max(0, basePrice + variationModifier);
  const memberUnit = memberUnitPrice(originalUnit, {
    legacyDiscountPercent: product.metadata_parsed.member_discount_enabled
      ? Number(product.metadata_parsed.member_discount_percent) || 0
      : null,
    productMemberPrice: product.member_price,
    variationMemberPrice: variation?.member_price,
    variationModifier,
  });

  if (memberUnit === null || !(await isMemberOrFullPrice(isMember))) {
    return {
      discountApplied: false,
      discountPercent: 0,
      discountedUnit: originalUnit,
      originalUnit,
    };
  }

  return {
    discountApplied: true,
    discountPercent: memberDiscountPercent(originalUnit, memberUnit),
    discountedUnit: memberUnit,
    originalUnit,
  };
}

/**
 * The revenue target a product sells under right now, cached per product for
 * the checkout. An unresolvable target is not a checkout error: the order is
 * still taken, and ledger posting resolves it (or waits) later.
 */
async function revenueTargetFor(
  product: NormalizedProduct,
  db: CheckoutDb,
  cache: Map<string, RevenueTarget | null>
): Promise<RevenueTarget | null> {
  if (!cache.has(product.$id)) {
    let target: RevenueTarget | null = null;
    try {
      target = await resolveRevenueTarget(db, product);
    } catch (error) {
      // A failed settings/sales-type read must not block the sale either;
      // posting retries the resolution later.
      console.error(
        `[checkout] revenue target lookup failed for ${product.$id}:`,
        error
      );
    }
    cache.set(product.$id, target);
  }
  return cache.get(product.$id) ?? null;
}

/**
 * Rebuilds the checkout from stored product rows: prices, member discount,
 * stock and purchase limits are all resolved server-side. Throws
 * {@link CheckoutValidationError} when a line cannot be fulfilled.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: orchestrates checkout validation, pricing and ledger resolution in one place
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
  const targetCache = new Map<string, RevenueTarget | null>();
  const isMember = createMembershipResolver(authClient, userId);
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
        isMember,
      });
      validatedProducts.add(product.$id);
    }

    const variation = findVariation(product, input.variationId);
    const pricing = await resolvePricing(product, variation, isMember);

    const productName = product.title || product.slug || product.$id;

    const answers = validatedAnswers(product, input.customFields, productName);

    const revenueTarget = await revenueTargetFor(product, db, targetCache);

    trustedItems.push({
      // Snapshotted so ledger posting and any later refund use the account,
      // VAT code and department this sale was made under, even if the product
      // or its sales type is edited in between.
      finago_account_number: revenueTarget?.accountNumber ?? null,
      finago_department: revenueTarget?.departmentId ?? null,
      finago_vat_code: revenueTarget?.vatCode ?? null,
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
      // They are reconciled against the product's own questions first, though:
      // an order missing a required answer, or carrying an invented field or a
      // relabelled one, is an order fulfilment cannot pack.
      variationId: input.variationId,
      variationName: variation?.name,
      customFields: answers.accepted,
      customFieldLabels: Object.fromEntries(
        answers.details.map((answer) => [answer.id, answer.label])
      ),
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
