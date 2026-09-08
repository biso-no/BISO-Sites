import type {
  ContentTranslations,
  WebshopProducts,
} from "@repo/api/types/appwrite";

type ProductCustomFieldType =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "email";

export interface ProductCustomField {
  helpText?: string;
  id: string;
  label: string;
  options?: string[];
  placeholder?: string;
  required?: boolean;
  type: ProductCustomFieldType;
}

/**
 * A `product_custom_fields` row as the storefront reads it back. Declared here
 * rather than taken from the generated Appwrite types so the storefront is not
 * blocked on regenerating them after the table is pushed.
 */
export interface ProductCustomFieldRow {
  $id: string;
  enabled?: boolean | null;
  field_key?: string | null;
  help_text?: string | null;
  is_required?: boolean | null;
  label?: string | null;
  options?: string[] | null;
  placeholder?: string | null;
  sort_order?: number | null;
  type?: string | null;
}

const CUSTOM_FIELD_TYPES = new Set<ProductCustomFieldType>([
  "text",
  "textarea",
  "number",
  "select",
  "email",
]);

/**
 * Turns stored rows into the shape the storefront and checkout both use.
 *
 * `id` is the row's `field_key`, not its `$id`: that key is what gets written
 * onto each `order_item_field_answers` row, and imported WordPress fields carry a
 * key that differs from their row id.
 */
export function toProductCustomFields(
  rows: ProductCustomFieldRow[] | null | undefined
): ProductCustomField[] {
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows
    .filter((row) => row.enabled !== false && row.label)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((row) => {
      const type = (row.type ?? "text") as ProductCustomFieldType;
      return {
        helpText: row.help_text ?? undefined,
        id: row.field_key ?? row.$id,
        label: row.label as string,
        options: row.options ?? undefined,
        placeholder: row.placeholder ?? undefined,
        required: row.is_required ?? false,
        type: CUSTOM_FIELD_TYPES.has(type) ? type : "text",
      };
    });
}

export interface ProductVariation {
  description?: string;
  id: string;
  is_default?: boolean;
  name: string;
  price_modifier?: number;
  sku?: string;
  stock_quantity?: number;
}

export type Product = WebshopProducts;

// Helper interface for working with product data including translations
// `custom_fields` is omitted alongside `variations` for the same reason: this
// view carries its own lighter shape (`ProductCustomField`), not the generated
// relationship row. The generated type gained this relationship when product
// custom fields moved off `custom_fields_json`.
export interface ProductWithTranslations
  extends Omit<Partial<WebshopProducts>, "custom_fields" | "variations"> {
  category?: string;
  custom_fields?: ProductCustomField[];
  description?: string;
  dimensions?: string;
  image?: string;
  images?: string[];
  is_digital?: boolean;
  max_per_order?: number;
  max_per_user?: number;
  member_discount_enabled?: boolean;
  member_discount_percent?: number;
  metadata_parsed?: ProductMetadata;
  price?: number;
  shipping_required?: boolean;
  sku?: string;
  stock_quantity?: number;
  // Convenience properties for the current locale
  title?: string;
  translations?: ContentTranslations[];
  variations?: ProductVariation[];
  weight?: number;
}

interface ProductMetadata extends Record<string, unknown> {
  category?: string;
  custom_fields?: ProductCustomField[];
  dimensions?: string;
  image?: string;
  images?: string[];
  is_digital?: boolean;
  max_per_order?: number;
  max_per_user?: number;
  member_discount_enabled?: boolean;
  member_discount_percent?: number;
  price?: number;
  shipping_required?: boolean;
  sku?: string;
  stock_quantity?: number;
  variations?: ProductVariation[];
  weight?: number;
}

export interface ProductTranslation {
  description: string;
  title: string;
}

export interface CreateProductData {
  campus_id: string;
  metadata?: ProductMetadata;
  slug: string;
  status: "draft" | "published" | "archived";
  translations: {
    en?: ProductTranslation;
    no?: ProductTranslation;
  };
}

export interface UpdateProductData {
  campus_id?: string;
  metadata?: ProductMetadata;
  slug?: string;
  status?: "draft" | "published" | "archived";
  translations?: {
    en?: ProductTranslation;
    no?: ProductTranslation;
  };
}

export interface ListProductsParams {
  campus_id?: string;
  limit?: number;
  locale?: "en" | "no";
  offset?: number;
  search?: string;
  status?: "draft" | "published" | "archived";
}
