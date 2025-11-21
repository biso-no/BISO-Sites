import type {
  ContentTranslations,
  WebshopProducts,
} from "@repo/api/types/appwrite";

export type ProductCustomFieldType = "text" | "textarea" | "number" | "select";

export interface ProductCustomField {
  id: string;
  label: string;
  type: ProductCustomFieldType;
  required?: boolean;
  placeholder?: string;
  options?: string[];
}

export interface ProductVariation {
  id: string;
  name: string;
  description?: string;
  price_modifier?: number;
  sku?: string;
  stock_quantity?: number;
  is_default?: boolean;
}

type Product = WebshopProducts;

// Helper type for products with parsed metadata
export type ProductWithTranslations = WebshopProducts & {
  metadata_parsed?: ProductMetadata;
};

// Fields stored in metadata JSON (not top-level database fields)
export interface ProductMetadata extends Record<string, unknown> {
  sku?: string;
  images?: string[];
  max_per_user?: number;
  max_per_order?: number;
  custom_fields?: ProductCustomField[];
  variations?: ProductVariation[];
}

export interface ProductTranslation {
  title: string;
  description: string;
}

export interface CreateProductData {
  slug: string;
  status: "draft" | "published" | "archived";
  campus_id: string;
  // Top-level database fields
  category: string;
  regular_price: number;
  member_price?: number;
  member_only?: boolean;
  stock?: number;
  image?: string;
  // Additional fields in metadata JSON
  metadata?: ProductMetadata;
  translations: {
    en: ProductTranslation;
    no: ProductTranslation;
  };
}

export interface UpdateProductData {
  slug?: string;
  status?: "draft" | "published" | "archived";
  campus_id?: string;
  // Top-level database fields
  category?: string;
  regular_price?: number;
  member_price?: number;
  member_only?: boolean;
  stock?: number;
  image?: string;
  // Additional fields in metadata JSON
  metadata?: ProductMetadata;
  translations?: {
    en: ProductTranslation;
    no: ProductTranslation;
  };
}

export interface ListProductsParams {
  status?: "draft" | "published" | "archived";
  campus_id?: string;
  locale?: "en" | "no";
  category?: string;
  member_only?: boolean;
  stock_min?: number;
  stock_max?: number;
  price_min?: number;
  price_max?: number;
  limit?: number;
  offset?: number;
  search?: string;
}
