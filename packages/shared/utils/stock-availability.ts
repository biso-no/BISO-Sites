interface ReservationQuantity {
  quantity?: number | null;
}

/**
 * Sum reserved quantities across reservation rows, treating missing or
 * non-numeric quantities as zero.
 */
export function sumReservedQuantity(
  reservations: ReservationQuantity[]
): number {
  let total = 0;
  for (const reservation of reservations) {
    total +=
      typeof reservation.quantity === "number" ? reservation.quantity : 0;
  }
  return total;
}

/**
 * Available stock = stock − reserved, floored at 0. Untracked stock
 * (`null`/`undefined`) is treated as unlimited (`Infinity`).
 */
export function computeAvailableStock(
  stock: number | null | undefined,
  reservedQuantity: number
): number {
  if (stock === null || stock === undefined) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.max(0, stock - reservedQuantity);
}
