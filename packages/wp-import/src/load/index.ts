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
 * A `content_translations` row already in Appwrite, as read back by
 * loadContentTranslations(). Carries the text as well as the `$id` so a
 * re-run can reuse a translation it already paid for instead of spending
 * another OpenAI call on it.
 */
export interface ExistingTranslation {
  $id: string;
  description: string;
  locale: ContentLocale;
  short_description: string | null;
  title: string;
}

/**
 * The target-locale translation for `contentId` if a previous run already
 * wrote one, in the shape buildTranslationRows expects — otherwise null,
 * meaning the caller must generate it.
 *
 * This is what makes `load --apply` cheap to resume: translation dominates
 * the load, and re-translating a row whose text has not changed buys nothing.
 */
export function existingTargetContent(
  existing: Map<string, ExistingTranslation> | undefined,
  contentId: string,
  locale: ContentLocale
): LocaleContent | null {
  const row = existing?.get(translationKey(contentId, locale));
  if (!row) {
    return null;
  }
  return {
    description: row.description,
    locale,
    shortDescription: row.short_description,
    title: row.title,
  };
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
  existing?: Map<string, ExistingTranslation>;
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
    const existingId = input.existing?.get(
      translationKey(input.contentId, content.locale)
    )?.$id;
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

/**
 * Builds the nested `product_variations` children for one product.
 *
 * `webshop_products.variations` is a oneToMany relationship with
 * `onDelete: cascade`, so the children are written inline with the parent —
 * the same shape as order_items. Each child keeps its deterministic
 * `wpvar<wc_variation_id>` id so a re-run upserts in place rather than
 * duplicating, and carries the parent's permissions explicitly rather than
 * relying on inheritance.
 */
export function buildVariationRows(
  variations: Array<{ row: Record<string, unknown>; rowId: string }>,
  permissions: string[]
): Record<string, unknown>[] {
  return variations.map((variation) => ({
    ...variation.row,
    $id: variation.rowId,
    $permissions: permissions,
  }));
}

export function buildProductUpsert(
  product: {
    row: Record<string, unknown>;
    rowId: string;
    variations?: Array<{ row: Record<string, unknown>; rowId: string }>;
  },
  translations: TranslationPayload[]
): Record<string, unknown> {
  const status = String(product.row.status ?? "draft");
  const permissions = buildPublicContentPermissions(status);
  return {
    ...product.row,
    $permissions: permissions,
    translation_refs: translations,
    variations: buildVariationRows(product.variations ?? [], permissions),
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
 * Derives an order's campus_id from its first line item whose product
 * resolves against `productCampusByRowId`. Returns null (never throws) so one
 * bad order can't take down the whole orders branch — the caller counts nulls
 * in its summary instead.
 */
export function resolveOrderCampusId(
  items: TransformedOrderItem[],
  productCampusByRowId: Map<string, string>
): string | null {
  for (const item of items) {
    const campusId = productCampusByRowId.get(item.productRowId);
    if (campusId) {
      return campusId;
    }
  }

  return null;
}

/**
 * Builds the nested `order_items` children for one order.
 *
 * Columns are listed explicitly rather than spread from the transformed item.
 * `order_items` has no flat `product_id` or `title` column — only the
 * `product` and `variation` relationships — and spreading a shape that
 * carried `product_id` was rejected by Appwrite for every order in the
 * archive. An explicit list cannot leak a non-column again.
 *
 * A relationship is attached **only** when its target row is actually being
 * imported. Appwrite rejects a write naming a row that does not exist, and
 * most of the 14k orders reach back years past the current catalogue. The
 * `variation` case is subtler still: WooCommerce line items name the member
 * or the non-member variation, but buildVariations collapses that pair into one
 * row keyed by the non-member id, so roughly half of all variation ids have
 * no row at all. `name` always survives, so an unlinked line still says what
 * was bought.
 *
 * Children carry the parent's permissions explicitly rather than relying on
 * inheritance, so a buyer can read their own order lines.
 */
export function buildOrderItemRows(
  items: TransformedOrderItem[],
  importedProductRowIds: Set<string>,
  importedVariationRowIds: Set<string>,
  permissions: string[]
): Record<string, unknown>[] {
  return items.map((item) => ({
    $id: item.rowId,
    $permissions: permissions,
    line_total: item.line_total,
    name: item.name,
    quantity: item.quantity,
    unit_price: item.unit_price,
    ...(importedProductRowIds.has(item.productRowId)
      ? { product: item.productRowId }
      : {}),
    ...(item.variationRowId && importedVariationRowIds.has(item.variationRowId)
      ? { variation: item.variationRowId }
      : {}),
  }));
}
