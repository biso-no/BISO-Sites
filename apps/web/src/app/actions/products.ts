"use server";

import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import type { WebshopProducts } from "@repo/api/types/appwrite";

/**
 * One published product with every translation, for the checkout preview.
 *
 * No locale filter: the shop lists, and the product page renders, every
 * published product whatever its languages, and 52 of the 55 have no English
 * row. Filtering here refused each of those at checkout for an English reader
 * ("Product … is not available anymore") after it had been added to the cart.
 * `loadProduct` in `orders.ts` picks the reader's translation and falls back
 * to the one that exists — the same rule the storefront uses.
 */
export async function getProduct(id: string): Promise<WebshopProducts | null> {
  try {
    const { db } = await createSessionClient();

    const response = await db.listRows<WebshopProducts>(
      "app",
      "webshop_products",
      [
        Query.equal("$id", id),
        // `webshop_products` grants row read to `any`, so without this a draft,
        // pending-approval or archived product is readable by id — and this is
        // the read the checkout preview builds its order lines from
        // (`buildOrderItems` in app/actions/orders.ts). `apps/api` refuses an
        // unpublished product again on the trusted path; this keeps the site
        // from quoting one in the first place.
        Query.equal("status", "published"),
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
          // Checkout questions, so required answers can be enforced server-side.
          "custom_fields.$id",
          "custom_fields.field_key",
          "custom_fields.label",
          "custom_fields.type",
          "custom_fields.is_required",
          "custom_fields.placeholder",
          "custom_fields.help_text",
          "custom_fields.options",
          "custom_fields.sort_order",
          "custom_fields.enabled",
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
