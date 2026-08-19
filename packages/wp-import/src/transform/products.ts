import type { WcStoreProduct, WpProductPost } from "../extract/index";
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
const MAX_VARIANTS_JSON_LENGTH = 8192;

/**
 * Shape actually parsed by ProductVariant in
 * apps/admin/.../shop/[id]/_components/shop-studio-editor.tsx — not the raw
 * WooCommerce Store API variation shape ({ id: number, attributes }).
 */
interface StudioVariant {
  id: string;
  name: string;
  price: number;
  stock: number;
  type: string;
}

function buildVariantName(
  attributes: Array<{ name: string; value: string }>
): string {
  return attributes.map((attribute) => attribute.value).join(" / ");
}

/**
 * The Store API's `variations` carries no prices at all — only id +
 * attributes (confirmed in fixtures/products.sample.json) — so price/stock
 * cannot be recovered from this snapshot. Both are written as 0 rather than
 * left undefined or copied from the base product's regular_price: paired
 * with forcing `status: "draft"` on a variable product (see
 * transformProduct below), a zero price inside a draft reads as obviously
 * unfinished, not subtly wrong.
 */
function buildVariantsJson(
  variations: Array<{
    attributes: Array<{ name: string; value: string }>;
    id: number;
  }>
): string | null {
  if (variations.length === 0) {
    return null;
  }

  let list: StudioVariant[] = variations.map((variation) => ({
    id: String(variation.id),
    name: buildVariantName(variation.attributes),
    price: 0,
    stock: 0,
    type: "default",
  }));

  // Defensive cap so a product with an unusually large number of variations
  // can never fail the whole load with an Appwrite validation error — trim
  // from the end until the JSON fits webshop_products.variants_json (8192).
  let json = JSON.stringify(list);
  while (json.length > MAX_VARIANTS_JSON_LENGTH && list.length > 0) {
    list = list.slice(0, -1);
    json = JSON.stringify(list);
  }
  return json;
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
  input: WpProductPost & { store: WcStoreProduct | null }
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

  const variations = input.store?.variations ?? [];
  const memberVariantWarning = variations.some((variation) =>
    variation.attributes.some((attribute) =>
      MEMBER_ATTRIBUTE.test(attribute.name)
    )
  );
  if (memberVariantWarning) {
    warnings.push(
      `Product ${input.id} has member-status variants; set member_price manually`
    );
  }

  // The Store API's `variations` carries id + attributes but no prices (see
  // buildVariantsJson above), so the real 250–1500 price range for a product
  // like the Booklocker is unrecoverable from this snapshot. Importing it as
  // `published` at a single flat price would put a live, purchasable,
  // six-times-under-priced product on the site. Force `draft` instead so a
  // human sets real per-variant prices before it goes live.
  const isVariable = input.store?.type === "variable";
  if (isVariable) {
    warnings.push(
      `Product ${input.id} (${label}) is variable; imported as draft with variant prices set to 0 — set prices manually before publishing`
    );
  }

  const imageUrls = (input.store?.images ?? []).map((image) => image.src);

  const rawCategory = input.store?.categories?.[0]?.name ?? null;
  const category = rawCategory === UNCATEGORIZED ? null : rawCategory;

  const variantsJson = buildVariantsJson(variations);
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
    ...(variantsJson ? { variants_json: variantsJson } : {}),
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
    },
    reject: null,
    warnings,
  };
}
