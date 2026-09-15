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
