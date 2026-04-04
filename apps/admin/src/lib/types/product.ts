import type { WebshopProducts } from "@repo/api/types/appwrite";

export type ProductCustomFieldType = "text" | "textarea" | "number" | "select";

export interface ProductCustomField {
  id: string;
  label: string;
  options?: string[];
  placeholder?: string;
  required?: boolean;
  type: ProductCustomFieldType;
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

type Product = WebshopProducts;

// Helper type for products with parsed metadata
export type ProductWithTranslations = WebshopProducts & {
  metadata_parsed?: ProductMetadata;
};

// Fields stored in metadata JSON (not top-level database fields)
export interface ProductMetadata extends Record<string, unknown> {
  custom_fields?: ProductCustomField[];
  images?: string[];
  max_per_order?: number;
  max_per_user?: number;
  sku?: string;
  variations?: ProductVariation[];
}

export interface ProductTranslation {
  description: string;
  title: string;
}

export interface CreateProductData {
  campus_id: string;
  // Top-level database fields
  category: string;
  departmentId?: string;
  image?: string;
  member_only?: boolean;
  member_price?: number;
  // Additional fields in metadata JSON
  metadata?: ProductMetadata;
  regular_price: number;
  slug: string;
  status?: "draft" | "published" | "archived";
  stock?: number;
  translations: {
    en: ProductTranslation;
    no: ProductTranslation;
  };
}

export interface UpdateProductData {
  campus_id?: string;
  // Top-level database fields
  category?: string;
  image?: string;
  member_only?: boolean;
  member_price?: number;
  // Additional fields in metadata JSON
  metadata?: ProductMetadata;
  regular_price?: number;
  slug?: string;
  status?: "draft" | "published" | "archived";
  stock?: number;
  translations?: {
    en: ProductTranslation;
    no: ProductTranslation;
  };
}

export interface ListProductsParams {
  campus_id?: string;
  category?: string;
  limit?: number;
  locale?: "en" | "no";
  member_only?: boolean;
  offset?: number;
  price_max?: number;
  price_min?: number;
  search?: string;
  status?: "draft" | "published" | "archived";
  stock_max?: number;
  stock_min?: number;
}
