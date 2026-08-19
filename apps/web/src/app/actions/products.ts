"use server";

import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import type { WebshopProducts } from "@repo/api/types/appwrite";

export async function getProduct(
  id: string,
  locale: "en" | "no"
): Promise<WebshopProducts | null> {
  try {
    const { db } = await createSessionClient();

    const response = await db.listRows<WebshopProducts>(
      "app",
      "webshop_products",
      [
        Query.equal("$id", id),
        Query.equal("translation_refs.locale", locale),
        Query.select([
          "$id",
          "$createdAt",
          "$updatedAt",
          "slug",
          "status",
          "campus_id",
          "category",
          "regular_price",
          "member_price",
          "member_only",
          "image",
          "stock",
          "metadata",
          "departmentId",
          "campus.$id",
          "campus.name",
          "department.$id",
          "department.Name",
          "translation_refs.$id",
          "translation_refs.$createdAt",
          "translation_refs.$updatedAt",
          "translation_refs.content_id",
          "translation_refs.content_type",
          "translation_refs.locale",
          "translation_refs.title",
          "translation_refs.description",
          "translation_refs.short_description",
          "translation_refs.additional_fields",
          "variations.*",
        ]),
        Query.limit(1),
      ]
    );

    return response.rows[0] ?? null;
  } catch (error) {
    console.error("Error getting product:", error);
    return null;
  }
}
