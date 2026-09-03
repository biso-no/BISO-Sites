import type {
  WcProductVariation,
  WcStoreProduct,
  WpProductPost,
} from "../extract/index";
import type { RejectRow } from "../types";
import {
  decodeEntities,
  normalizeDescriptionHtml,
  plainTextExcerpt,
} from "./html";
import { buildTimestampOverrides } from "./timestamps";

/** ACF department field suffix per Appwrite campus.$id. */
const DEPARTMENT_FIELD_BY_CAMPUS: Record<string, string> = {
  "1": "department_oslo",
  "2": "department_bergen",
  "3": "department_trondheim",
  "4": "department_stavanger",
  "5": "department_national",
};

const MEMBER_ATTRIBUTE = /member/i;
const UNCATEGORIZED = "Uncategorized";
/**
 * Negation tokens that mark the *non-member* half of a membership attribute.
 * Real data uses both "Non BISO-member" (product 63469) and "Not a BISO
 * member" (product 9492), and both halves contain the word "member", so the
 * negation is the only thing that distinguishes them.
 */
const NON_MEMBER_OPTION = /\b(non|not|no|ikke|uten)\b|non-/i;

/**
 * One `product_variations` row. The table folds BISO membership into two
 * price columns on a single row rather than modelling it as its own
 * variation, which is why buildVariations groups rather than maps.
 */
export interface TransformedVariation {
  row: Record<string, unknown>;
  rowId: string;
}

const priceOf = (variation: WcProductVariation): number | null => {
  const raw = variation.regular_price || variation.price;
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : null;
};

/**
 * Splits a variation's attributes into the membership flag and everything
 * else. The remaining options, joined by " / ", are the variation's name —
 * matching the rows already in `product_variations`
 * (e.g. "3 Years Fall 2026 - Spring 2029 / Stavanger").
 */
function describeVariation(variation: WcProductVariation): {
  isMember: boolean;
  name: string;
} {
  let isMember = false;
  const rest: string[] = [];

  for (const attribute of variation.attributes) {
    if (MEMBER_ATTRIBUTE.test(attribute.name)) {
      isMember = !NON_MEMBER_OPTION.test(attribute.option);
      continue;
    }
    rest.push(attribute.option);
  }

  return { isMember, name: rest.join(" / ") };
}

function variationRow(
  variation: WcProductVariation,
  name: string,
  memberPrice: number | null,
  sortOrder: number
): TransformedVariation {
  return {
    row: {
      enabled: variation.status === "publish",
      member_price: memberPrice,
      name: name || variation.sku || String(variation.id),
      regular_price: priceOf(variation),
      sku: variation.sku || null,
      sort_order: sortOrder,
      stock: variation.stock_quantity,
    },
    rowId: `wpvar${variation.id}`,
  };
}

/**
 * Turns WooCommerce variations into `product_variations` rows.
 *
 * WooCommerce models "BISO member" as a *separate variation* of every
 * duration, so a product with 2 durations x 2 membership states arrives as 4
 * variations. Appwrite models it as one row per duration carrying both
 * `regular_price` and `member_price`, so the membership axis is collapsed
 * here. The collapsed row keeps the non-member variation's WooCommerce id,
 * which is the convention the rows already in Appwrite follow.
 *
 * Collapsing only happens for the unambiguous case — exactly one member and
 * one non-member variation sharing a name. Anything else (no membership
 * attribute at all, or a grouping this cannot read confidently) is emitted
 * one row per variation, so a variation is never silently dropped; the
 * caller is told which names were left unpaired.
 */
export function buildVariations(variations: WcProductVariation[]): {
  rows: TransformedVariation[];
  unpairedNames: string[];
} {
  const groups = new Map<
    string,
    { members: WcProductVariation[]; regulars: WcProductVariation[] }
  >();

  for (const variation of variations) {
    const { isMember, name } = describeVariation(variation);
    const group = groups.get(name) ?? { members: [], regulars: [] };
    (isMember ? group.members : group.regulars).push(variation);
    groups.set(name, group);
  }

  const rows: TransformedVariation[] = [];
  const unpairedNames: string[] = [];
  let sortOrder = 0;

  for (const [name, group] of groups) {
    const memberOnly = group.regulars.length === 0 && group.members.length > 0;
    const pairable =
      group.regulars.length === 1 &&
      (group.members.length === 0 || group.members.length === 1);

    if (pairable) {
      const anchor = group.regulars[0] as WcProductVariation;
      const member = group.members[0];
      rows.push(
        variationRow(anchor, name, member ? priceOf(member) : null, sortOrder)
      );
      sortOrder += 1;
      continue;
    }

    // Cannot pair with confidence — emit every variation rather than lose one.
    if (!memberOnly || group.members.length > 1) {
      unpairedNames.push(name || "(unnamed)");
    }
    for (const variation of [...group.regulars, ...group.members]) {
      rows.push(variationRow(variation, name, null, sortOrder));
      sortOrder += 1;
    }
  }

  return { rows, unpairedNames };
}

export interface TransformedProduct {
  /** Normalized, studio-safe HTML — not the raw WordPress source. */
  descriptionHtml: string;
  imageUrls: string[];
  memberVariantWarning: boolean;
  row: Record<string, unknown>;
  rowId: string;
  shortDescription: string;
  title: string;
  /** Written as nested `variations` children of the product row. */
  variations: TransformedVariation[];
}

export function resolveAcfCampusAndDepartment(
  acf: Record<string, string | false>
): { campusId: string | null; departmentId: string | null } {
  const rawCampus = acf.campus;
  const campusId =
    typeof rawCampus === "string" && rawCampus.length > 0 ? rawCampus : null;
  if (!campusId) {
    return { campusId: null, departmentId: null };
  }

  const field = DEPARTMENT_FIELD_BY_CAMPUS[campusId];
  const rawDepartment = field ? acf[field] : false;
  const departmentId =
    typeof rawDepartment === "string" && rawDepartment.length > 0
      ? rawDepartment
      : null;

  return { campusId, departmentId };
}

export function resolvePrice(store: WcStoreProduct): number | null {
  const raw =
    store.type === "variable" && store.prices.price_range
      ? store.prices.price_range.min_amount
      : store.prices.price;
  if (!raw) {
    return null;
  }
  const parsed = Number.parseFloat(raw);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return parsed / 10 ** (store.prices.currency_minor_unit ?? 0);
}

export function transformProduct(
  input: WpProductPost & {
    store: WcStoreProduct | null;
    /** Absent on snapshots taken before variations were extracted. */
    variations?: WcProductVariation[];
  }
): {
  product: TransformedProduct | null;
  reject: RejectRow | null;
  warnings: string[];
} {
  const warnings: string[] = [];
  const title = decodeEntities(
    input.store?.name ?? input.title.rendered ?? ""
  ).trim();
  const label = title || input.slug;

  const { campusId, departmentId } = resolveAcfCampusAndDepartment(input.acf);
  if (!campusId) {
    return {
      product: null,
      reject: {
        label,
        reason: "No ACF campus set; webshop_products.campus_id is required",
        sourceId: input.id,
      },
      warnings,
    };
  }

  if (!title) {
    return {
      product: null,
      reject: {
        label: input.slug,
        reason: "No product title; content_translations.title is required",
        sourceId: input.id,
      },
      warnings,
    };
  }

  const price = input.store ? resolvePrice(input.store) : null;
  if (price === null) {
    return {
      product: null,
      reject: {
        label,
        reason:
          "No resolvable price; webshop_products.regular_price is required",
        sourceId: input.id,
      },
      warnings,
    };
  }

  const sourceHtml = input.store?.description || input.content.rendered || "";
  const description = normalizeDescriptionHtml(sourceHtml);
  if (description.truncated) {
    warnings.push(`Product ${input.id} description truncated to 8000 chars`);
  }

  const shortDescription = plainTextExcerpt(
    input.store?.short_description || sourceHtml,
    500
  );

  const { rows: variations, unpairedNames } = buildVariations(
    input.variations ?? []
  );
  const memberVariantWarning = variations.some(
    (variation) => variation.row.member_price !== null
  );
  if (unpairedNames.length > 0) {
    warnings.push(
      `Product ${input.id} has variations this importer could not pair by membership (${unpairedNames.join(", ")}); each was imported separately — check member_price manually`
    );
  }

  // Variation prices now come from /wc/v3/products/<id>/variations, so they
  // are real rather than zeroed. A variable product is still forced to
  // `draft`: the membership axis is collapsed into member_price by
  // buildVariations, and a human confirming that grouping before the product
  // is purchasable is cheap next to publishing a mispriced one.
  const isVariable = input.store?.type === "variable";
  if (isVariable) {
    warnings.push(
      `Product ${input.id} (${label}) is variable with ${variations.length} variation(s); imported as draft — check the prices before publishing`
    );
  }
  if (isVariable && variations.length === 0) {
    warnings.push(
      `Product ${input.id} (${label}) is variable but no variations were extracted — re-run extract with WooCommerce credentials`
    );
  }

  const imageUrls = (input.store?.images ?? []).map((image) => image.src);

  const rawCategory = input.store?.categories?.[0]?.name ?? null;
  const category = rawCategory === UNCATEGORIZED ? null : rawCategory;

  const publishedStatus = input.status === "publish" ? "published" : "draft";

  const row: Record<string, unknown> = {
    // Backdated to the WordPress publish/modify dates; `webshop_products` has
    // no date column and the storefront lists by `$createdAt`.
    ...buildTimestampOverrides(input.date_gmt, input.modified_gmt),
    campus: campusId,
    campus_id: campusId,
    category,
    department: departmentId,
    departmentId,
    inventory_mode: "unlimited",
    regular_price: price,
    slug: input.slug,
    status: isVariable ? "draft" : publishedStatus,
  };

  return {
    product: {
      descriptionHtml: description.html,
      imageUrls,
      memberVariantWarning,
      row,
      rowId: `wpprod${input.id}`,
      shortDescription,
      title,
      variations,
    },
    reject: null,
    warnings,
  };
}
