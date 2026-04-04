import type {
  ContentTranslations,
  WebshopProducts,
} from "@repo/api/types/appwrite";

type ProductCustomFieldType = "text" | "textarea" | "number" | "select";

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

export type Product = WebshopProducts;

// Helper interface for working with product data including translations
export interface ProductWithTranslations extends Partial<WebshopProducts> {
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
