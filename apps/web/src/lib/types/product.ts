import type {
  ContentTranslations,
  WebshopProducts,
} from "@repo/api/types/appwrite";

export type ProductCustomFieldType = "text" | "textarea" | "number" | "select";

export type ProductCustomField = {
  id: string;
  label: string;
  type: ProductCustomFieldType;
  required?: boolean;
  placeholder?: string;
  options?: string[];
};

export type ProductVariation = {
  id: string;
  name: string;
  description?: string;
  price_modifier?: number;
  sku?: string;
  stock_quantity?: number;
  is_default?: boolean;
};

export type Product = WebshopProducts;

// Helper interface for working with product data including translations
export interface ProductWithTranslations extends Partial<WebshopProducts> {
  translations?: ContentTranslations[];
  // Convenience properties for the current locale
  title?: string;
  description?: string;
  metadata_parsed?: ProductMetadata;
  price?: number;
  sku?: string;
  stock_quantity?: number;
  category?: string;
  image?: string;
  images?: string[];
  weight?: number;
  dimensions?: string;
  is_digital?: boolean;
  shipping_required?: boolean;
  member_discount_enabled?: boolean;
  member_discount_percent?: number;
  max_per_user?: number;
  max_per_order?: number;
  custom_fields?: ProductCustomField[];
  variations?: ProductVariation[];
}

export interface ProductMetadata extends Record<string, unknown> {
  price?: number;
  sku?: string;
  stock_quantity?: number;
  category?: string;
  image?: string;
  images?: string[];
  weight?: number;
  dimensions?: string;
  is_digital?: boolean;
  shipping_required?: boolean;
  member_discount_enabled?: boolean;
  member_discount_percent?: number;
  max_per_user?: number;
  max_per_order?: number;
  custom_fields?: ProductCustomField[];
  variations?: ProductVariation[];
}

export type ProductTranslation = {
  title: string;
  description: string;
};

export type CreateProductData = {
  slug: string;
  status: "draft" | "published" | "archived";
  campus_id: string;
  metadata?: ProductMetadata;
  translations: {
    en?: ProductTranslation;
    no?: ProductTranslation;
  };
};

export type UpdateProductData = {
  slug?: string;
  status?: "draft" | "published" | "archived";
  campus_id?: string;
  metadata?: ProductMetadata;
  translations?: {
    en?: ProductTranslation;
    no?: ProductTranslation;
  };
};

export type ListProductsParams = {
  status?: "draft" | "published" | "archived";
  campus_id?: string;
  locale?: "en" | "no";
  limit?: number;
  offset?: number;
  search?: string;
};
