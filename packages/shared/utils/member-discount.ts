const MINOR_UNITS_PER_MAJOR = 100;
const PERCENT = 100;

/**
 * A member-discounted unit price in kroner, rounded to whole øre.
 *
 * Shared by the web cart action and the API checkout pricing: the API compares
 * the client's total with its own to the øre, so both must round the same way.
 * Unrounded, a non-integer discount gives sub-øre prices whose per-line øre sums
 * can miss the rounded order total, which ledger posting refuses as unbalanced.
 */
export function discountedUnitPrice(
  originalUnit: number,
  discountPercent: number
): number {
  const discounted = Math.max(
    0,
    originalUnit * (1 - discountPercent / PERCENT)
  );
  return Math.round(discounted * MINOR_UNITS_PER_MAJOR) / MINOR_UNITS_PER_MAJOR;
}

function toWholeOre(kroner: number): number {
  return Math.round(kroner * MINOR_UNITS_PER_MAJOR) / MINOR_UNITS_PER_MAJOR;
}

function isPositivePrice(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export interface MemberPricingInput {
  /** Legacy `metadata.member_discount_percent`, honoured when no fixed price is set. */
  legacyDiscountPercent?: number | null;
  /** `webshop_products.member_price` — the fixed price admin sets. */
  productMemberPrice?: number | null;
  /** `product_variations.member_price`, which wins over the product's. */
  variationMemberPrice?: number | null;
  /** The variation's offset from the product's regular price. */
  variationModifier?: number;
}

/**
 * The unit price a member pays for a line whose regular unit price is
 * `originalUnit`, or `null` when the product offers members nothing.
 *
 * A fixed `member_price` (what the admin editor writes) takes precedence: the
 * variation's own member price if it has one, otherwise the product's member
 * price shifted by the variation's modifier, so a variation keeps the same
 * krone discount as its product. The legacy metadata percent is the fallback.
 * A member price at or above the regular price is no discount and is ignored.
 *
 * Shared by the web checkout action and the API checkout pricing so the
 * storefront, the quote and the charged amount all agree.
 */
export function memberUnitPrice(
  originalUnit: number,
  {
    legacyDiscountPercent,
    productMemberPrice,
    variationMemberPrice,
    variationModifier = 0,
  }: MemberPricingInput
): number | null {
  let fixed: number | null = null;
  if (isPositivePrice(variationMemberPrice)) {
    fixed = variationMemberPrice;
  } else if (isPositivePrice(productMemberPrice)) {
    fixed = productMemberPrice + variationModifier;
  }
  if (fixed !== null) {
    const unit = toWholeOre(Math.max(0, fixed));
    return unit < originalUnit ? unit : null;
  }
  if (isPositivePrice(legacyDiscountPercent)) {
    return discountedUnitPrice(originalUnit, legacyDiscountPercent);
  }
  return null;
}

/** The discount `memberUnit` represents, as a whole-number percent of `originalUnit`. */
export function memberDiscountPercent(
  originalUnit: number,
  memberUnit: number
): number {
  if (originalUnit <= 0) {
    return 0;
  }
  return Math.round(((originalUnit - memberUnit) / originalUnit) * PERCENT);
}
