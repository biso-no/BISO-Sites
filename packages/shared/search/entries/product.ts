import type { WebshopProducts } from "@repo/api/types/appwrite";
import {
  WebshopProductsInventoryMode,
  WebshopProductsStatus,
} from "@repo/api/types/appwrite";
import { isListedProduct } from "../../utils/product-visibility";
import { campusBucket, SEARCH_LOCALES, type SearchEntry } from "../types";
import {
  baseEntry,
  keywordsOf,
  type MapContext,
  nonEmpty,
  type TranslationText,
  textFields,
  textFor,
} from "./common";

type ProductRow = Pick<
  WebshopProducts,
  | "$id"
  | "slug"
  | "status"
  | "campus_id"
  | "departmentId"
  | "regular_price"
  | "member_price"
  | "member_only"
  | "category"
  | "tags"
  | "image"
  | "images"
  | "cover_pattern"
  | "stock"
  | "inventory_mode"
  | "unlisted"
>;

export function productEntries(
  row: ProductRow,
  translations: TranslationText[],
  ctx: MapContext
): SearchEntry[] {
  if (
    row.status !== WebshopProductsStatus.PUBLISHED ||
    !isListedProduct(row) ||
    !row.slug
  ) {
    return [];
  }
  // Buyers see only In stock / Out of stock, never the count. A missing
  // count is not tracked (in stock); zero or below is sold out.
  const inStock =
    row.inventory_mode === WebshopProductsInventoryMode.UNLIMITED ||
    (row.stock ?? 1) > 0;
  const entries: SearchEntry[] = [];
  for (const locale of SEARCH_LOCALES) {
    const text = textFor(translations, locale);
    if (!text) {
      return [];
    }
    entries.push({
      ...baseEntry(
        {
          type: "product",
          rowId: row.$id,
          locale,
          textLocale: text.locale,
          campusId: campusBucket(row.campus_id),
          url: `/shop/${row.slug}`,
        },
        ctx
      ),
      ...textFields(text),
      keywords: keywordsOf(row.tags),
      category: nonEmpty(row.category),
      cover_pattern: nonEmpty(row.cover_pattern),
      department: ctx.departmentName(row.departmentId),
      image: nonEmpty(row.image),
      in_stock: inStock,
      member_only: row.member_only === true,
      member_price: row.member_price ?? null,
      price: row.regular_price,
    });
  }
  return entries;
}
