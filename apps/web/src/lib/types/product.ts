import type {
  ContentTranslations,
  WebshopProducts,
} from "@repo/api/types/appwrite";

type ProductCustomFieldType = "text" | "textarea" | "number" | "select";

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
