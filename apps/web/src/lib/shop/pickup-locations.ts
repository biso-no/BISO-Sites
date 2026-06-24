/**
 * Campus pickup locations for the webshop.
 *
 * Products and orders are scoped to a BISO campus. Each campus hands out shop
 * orders at a different physical spot, so the pickup card / receipt resolves the
 * campus to one of these keys and renders the localized location string from the
 * `shop.pickup.campus.<key>` message bundle.
 */
export type CampusPickupKey =
  | "oslo"
  | "bergen"
  | "trondheim"
  | "stavanger"
  | "default";

const KNOWN_CAMPUSES: Exclude<CampusPickupKey, "default">[] = [
  "oslo",
  "bergen",
  "trondheim",
  "stavanger",
];

/**
 * Normalizes a campus name (e.g. "Oslo", "Trondheim", "BI Stavanger") to a
 * pickup key. Falls back to "default" for unknown / missing campuses so the UI
 * always has something sensible to show.
 */
export function normalizeCampusKey(name?: string | null): CampusPickupKey {
  if (!name) {
    return "default";
  }

  const normalized = name.trim().toLowerCase();
  const match = KNOWN_CAMPUSES.find((campus) => normalized.includes(campus));
  return match ?? "default";
}
