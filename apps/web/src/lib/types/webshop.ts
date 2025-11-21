import type { ContentTranslations } from "@repo/api/types/appwrite";

export interface ProductOption {
  type: "select" | "input";
  label: string;
  required: boolean;
  options?: string[];
  placeholder?: string;
}

export interface ProductMetadata {
  product_options?: ProductOption[];
  [key: string]: unknown;
}

interface ProductWithTranslation extends ContentTranslations {
  product_ref: NonNullable<ContentTranslations["product_ref"]>;
}

export const productCategories = ["Merch", "Trips", "Lockers", "Membership"] as const;
export type ProductCategory = (typeof productCategories)[number];

export function parseProductMetadata(metadataString: string | null | undefined): ProductMetadata {
  if (!metadataString) return {};

  try {
    return JSON.parse(metadataString);
  } catch {
    return {};
  }
}

export function formatPrice(price: number | null | undefined): string {
  if (!price || price === 0) return "Free";
  return `${price} NOK`;
}

function getProductCategory(category: string | null | undefined): ProductCategory {
  const cat = category as ProductCategory;
  return productCategories.includes(cat) ? cat : "Merch";
}

export function calculateSavings(regularPrice: number, memberPrice: number | null): number {
  if (!memberPrice) return 0;
  return Math.max(0, regularPrice - memberPrice);
}

export function getDisplayPrice(
  regularPrice: number,
  memberPrice: number | null,
  isMember: boolean,
): number {
  return isMember && memberPrice ? memberPrice : regularPrice;
}
