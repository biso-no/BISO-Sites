export interface ProductOption {
  label: string;
  options?: string[];
  placeholder?: string;
  required: boolean;
  type: "select" | "input";
}

export interface ProductMetadata {
  product_options?: ProductOption[];
  [key: string]: unknown;
}

export function parseProductMetadata(
  metadataString: string | null | undefined
): ProductMetadata {
  if (!metadataString) {
    return {};
  }

  try {
    return JSON.parse(metadataString);
  } catch {
    return {};
  }
}

export function calculateSavings(
  regularPrice: number,
  memberPrice: number | null
): number {
  if (!memberPrice) {
    return 0;
  }
  return Math.max(0, regularPrice - memberPrice);
}

export function getDisplayPrice(
  regularPrice: number,
  memberPrice: number | null,
  isMember: boolean
): number {
  return isMember && memberPrice ? memberPrice : regularPrice;
}
