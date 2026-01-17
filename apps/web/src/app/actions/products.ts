"use server";

import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import {
  type ContentTranslations,
  ContentType,
} from "@repo/api/types/appwrite";

export async function getProduct(
  id: string,
  locale: "en" | "no"
): Promise<ContentTranslations | null> {
  try {
    const { db } = await createSessionClient();

    // Query content_translations by content_id and locale
    const translationsResponse = await db.listRows<ContentTranslations>(
      "app",
      "content_translations",
      [
        Query.equal("content_type", ContentType.PRODUCT),
        Query.equal("content_id", id),
        Query.equal("locale", locale),
        Query.select([
          "content_id",
          "$id",
          "locale",
          "title",
          "description",
          "product_ref.*",
        ]),
        Query.limit(1),
      ]
    );

    if (translationsResponse.rows.length === 0) {
      return null;
    }

    return translationsResponse.rows[0] ?? null;
  } catch (error) {
    console.error("Error getting product:", error);
    return null;
  }
}
