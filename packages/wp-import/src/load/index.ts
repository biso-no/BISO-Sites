import {
  buildJobPermissions,
  buildPublicContentPermissions,
} from "../permissions";
import type { TransformedOrderItem } from "../transform/orders";
import type { ContentLocale } from "../types";

export interface TranslationPayload {
  $id?: string;
  $permissions: string[];
  content_id: string;
  content_type: string;
  description: string;
  locale: ContentLocale;
  short_description: string | null;
  title: string;
}

export interface LocaleContent {
  description: string;
  locale: ContentLocale;
  shortDescription: string | null;
  title: string;
}

/**
 * Key format shared between the Appwrite query in scripts/load.ts (which
 * builds the map) and buildTranslationRows below (which reads it) — kept in
 * one place so the two can't drift apart.
 */
export function translationKey(contentId: string, locale: string): string {
  return `${contentId}::${locale}`;
}

export function buildTranslationRows(input: {
  contentId: string;
  contentType: string;
  /**
   * `content_translations` has a unique index on
   * (content_type, content_id, locale). Without threading the existing row's
   * `$id` back in, `db.upsertRow` on a row that already exists collides on
   * that index instead of overwriting it — breaking safe resume of a
   * `load --apply` run. Keyed by translationKey(contentId, locale).
   */
  existingIds?: Map<string, string>;
  permissions: string[];
  source: LocaleContent;
  target: LocaleContent | null;
}): TranslationPayload[] {
  // Task 11 truncates the *source* text to the schema limits before
  // translation, but AI-translated target text is never re-checked and
  // translation frequently lengthens Norwegian into English. Re-truncate
  // both locales here so this protects every caller, not just the ones that
  // remember to do it themselves.
  const toRow = (content: LocaleContent): TranslationPayload => {
    const existingId = input.existingIds?.get(
      translationKey(input.contentId, content.locale)
    );
    return {
      ...(existingId ? { $id: existingId } : {}),
      $permissions: input.permissions,
      content_id: input.contentId,
      content_type: input.contentType,
      description: content.description.slice(0, 8000),
      locale: content.locale,
      short_description: content.shortDescription?.slice(0, 500) ?? null,
      title: content.title.slice(0, 500),
    };
  };

  return input.target
    ? [toRow(input.source), toRow(input.target)]
    : [toRow(input.source)];
}

/**
 * db.upsertRow validates as a full-document replace, so every required column
 * must be present on every write — a partial payload fails with
 * "Missing required attribute".
 */
export function buildJobUpsert(
  job: { row: Record<string, unknown>; rowId: string },
  translations: TranslationPayload[]
): Record<string, unknown> {
  const status = String(job.row.status ?? "draft");
  return {
    ...job.row,
    $permissions: buildJobPermissions(status),
    translations,
  };
}

export function buildProductUpsert(
  product: { row: Record<string, unknown>; rowId: string },
  translations: TranslationPayload[]
): Record<string, unknown> {
  const status = String(product.row.status ?? "draft");
  return {
    ...product.row,
    $permissions: buildPublicContentPermissions(status),
    translation_refs: translations,
  };
}

/**
 * Maps each transformed product's rowId (e.g. "wpprod37313") to its
 * campus_id, so an order's line items can resolve a campus without another
 * Appwrite round trip — the data already lives in snapshots/transformed.json.
 */
export function buildProductCampusIndex(
  products: Array<{ row: Record<string, unknown>; rowId: string }>
): Map<string, string> {
  const byRowId = new Map<string, string>();
  for (const product of products) {
    if (typeof product.row.campus_id === "string") {
      byRowId.set(product.rowId, product.row.campus_id);
    }
  }
  return byRowId;
}

/**
 * Derives an order's campus_id from its first line item whose product_id
 * resolves against `productCampusByRowId`. Returns null (never throws) on a
 * missing/malformed items_json so one bad order can't take down the whole
 * orders branch — the caller counts nulls in its summary instead.
 */
export function resolveOrderCampusId(
  items: TransformedOrderItem[],
  productCampusByRowId: Map<string, string>
): string | null {
  for (const item of items) {
    const campusId = productCampusByRowId.get(item.product_id);
    if (campusId) {
      return campusId;
    }
  }

  return null;
}

/**
 * Builds the nested `order_items` children for one order.
 *
 * The `product` relationship is attached **only** when that product row is
 * actually being imported. Appwrite rejects a write whose relationship names a
 * row that does not exist, and an order can easily reference a product that
 * was rejected at transform time (no ACF campus, unresolvable price) or that
 * predates the current catalogue entirely — 14k orders reach back years. The
 * flat `product_id` string is always written, so an unlinked line still says
 * what was bought.
 *
 * Children carry the parent's permissions explicitly rather than relying on
 * inheritance, so a buyer can read their own order lines.
 */
export function buildOrderItemRows(
  items: TransformedOrderItem[],
  importedProductRowIds: Set<string>,
  permissions: string[]
): Record<string, unknown>[] {
  return items.map((item) => {
    const { rowId, ...columns } = item;
    return {
      ...columns,
      $id: rowId,
      $permissions: permissions,
      ...(importedProductRowIds.has(item.product_id)
        ? { product: item.product_id }
        : {}),
    };
  });
}
