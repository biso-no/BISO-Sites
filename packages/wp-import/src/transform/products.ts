import type { WcStoreProduct, WpProductPost } from "../extract/index";
import type { RejectRow } from "../types";
import {
  decodeEntities,
  normalizeDescriptionHtml,
  plainTextExcerpt,
} from "./html";

/** ACF department field suffix per Appwrite campus.$id. */
const DEPARTMENT_FIELD_BY_CAMPUS: Record<string, string> = {
  "1": "department_oslo",
  "2": "department_bergen",
  "3": "department_trondheim",
  "4": "department_stavanger",
  "5": "department_national",
};

const MEMBER_ATTRIBUTE = /member/i;

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

  const imageUrls = (input.store?.images ?? []).map((image) => image.src);

  const row: Record<string, unknown> = {
    campus: campusId,
    campus_id: campusId,
    category: input.store?.categories?.[0]?.name ?? null,
    department: departmentId,
    departmentId,
    inventory_mode: "unlimited",
    regular_price: price,
    slug: input.slug,
    status: input.status === "publish" ? "published" : "draft",
    ...(variations.length > 0
      ? { variants_json: JSON.stringify(variations) }
      : {}),
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
