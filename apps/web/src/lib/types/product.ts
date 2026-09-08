import type {
  ContentTranslations,
  WebshopProducts,
} from "@repo/api/types/appwrite";

// The custom-field definitions and the rules for answering them are shared
// with `apps/api`, which the native app checks out through. Re-exported here so
// the storefront's existing imports keep working against one implementation
// rather than a copy that can drift from the one checkout enforces.
// Imported as well as re-exported: the shapes below reference it locally.
import type { ProductCustomField } from "@repo/shared/utils/product-custom-fields";

export {
  type ProductCustomField,
  type ProductCustomFieldRow,
  toProductCustomFields,
} from "@repo/shared/utils/product-custom-fields";

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
