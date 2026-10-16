/**
 * Appwrite lets a server SDK holding an API key override the `$createdAt` and
 * `$updatedAt` system columns by passing them inside `data` on any create,
 * update or upsert route — the documented path for migrating historical
 * records (https://appwrite.io/docs/products/databases/timestamp-overrides).
 *
 * That matters here because none of `orders`, `jobs` or `webshop_products`
 * carries its own creation-date column: `$createdAt` is the only timestamp the
 * app has. Without these overrides every imported row would be dated at
 * cutover, so the shop dashboard's date-range filter
 * (apps/admin/.../shop-studio-dashboard.tsx `orderIsInDateRange`) would bucket
 * years of WooCommerce history into a single day, and every `$createdAt`-
 * ordered list would show the archive in arbitrary order.
 */

/** Trailing `Z` or a `±HH:MM` / `±HHMM` offset on the time half of the value. */
const EXPLICIT_ZONE = /(?:Z|[+-]\d{2}:?\d{2})$/;

/**
 * Converts a WordPress/WooCommerce `*_gmt` timestamp to an ISO instant.
 *
 * The REST API emits these as bare `2024-03-22T16:28:02` with no zone
 * designator even though the value is UTC, and `new Date()` parses that form
 * in the *host machine's* local time — the same trap the job extraction window
 * hit (see `extractJobs`). Appending `Z` pins it to UTC so the import produces
 * identical rows regardless of where it runs.
 *
 * Returns null for anything unusable, which leaves the override off the
 * payload entirely so Appwrite stamps its own timestamp.
 */
export function wpGmtToIso(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = EXPLICIT_ZONE.test(trimmed) ? trimmed : `${trimmed}Z`;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

/**
 * Builds the `$createdAt` / `$updatedAt` pair for a row from its source
 * timestamps. Each key is omitted when its source date is unusable rather than
 * being sent as null, which Appwrite would reject.
 *
 * A source with no modification date falls back to its creation date, so an
 * imported row never claims to have been edited at import time.
 */
export function buildTimestampOverrides(
  createdGmt: string | null | undefined,
  modifiedGmt: string | null | undefined
): Record<string, string> {
  const createdAt = wpGmtToIso(createdGmt);
  const updatedAt = wpGmtToIso(modifiedGmt) ?? createdAt;

  const overrides: Record<string, string> = {};
  if (createdAt) {
    overrides.$createdAt = createdAt;
  }
  if (updatedAt) {
    overrides.$updatedAt = updatedAt;
  }
  return overrides;
}
