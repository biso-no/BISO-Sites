"use server";

import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import type { WebshopProducts } from "@repo/api/types/appwrite";

interface ListProductsParams {
  campus?: string;
  category?: string;
  limit?: number;
  locale?: "en" | "no";
  memberOnly?: boolean;
  status?: string;
}

export async function listProducts(
  params: ListProductsParams = {}
): Promise<WebshopProducts[]> {
  const {
    limit = 50,
    status = "published",
    campus,
    category,
    locale,
    memberOnly,
  } = params;

  try {
    const { db } = await createSessionClient();

    const queries = [
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
      ]),
      Query.limit(limit),
      Query.orderDesc("$createdAt"),
    ];

    if (locale) {
      queries.push(Query.equal("translation_refs.locale", locale));
    }

    if (status !== "all") {
      queries.push(Query.equal("status", status));
    }

    if (campus && campus !== "all") {
      queries.push(Query.equal("campus_id", campus));
    }

    if (category && category !== "all") {
      queries.push(Query.equal("category", category));
    }

    if (memberOnly !== undefined) {
      queries.push(Query.equal("member_only", memberOnly));
    }

    const productsResponse = await db.listRows<WebshopProducts>(
      "app",
      "webshop_products",
      queries
    );
    const products = productsResponse.rows;

    return products;
  } catch (error) {
    console.error("Error fetching products:", error);
    return [];
  }
}

/**
 * The product read for the redesigned page (RD-022).
 *
 * Identical to `getProductBySlug` except that it does **not** filter
 * `translation_refs` by locale. That filter is why the English product page was
 * blank: only 3 of the 55 published products have an English translation, so
 * for the other 52 the row came back carrying no usable copy and the page
 * rendered an empty headline. The caller picks the best available translation
 * with `getPrimaryTranslation`, which prefers the reader's locale.
 *
 * `getProductBySlug` is left untouched so the current page behaves exactly as
 * it does today with the shell flag off.
 */
export async function getProductDetailBySlug(
  slug: string
): Promise<WebshopProducts | null> {
  try {
    const { db } = await createSessionClient();

    const response = await db.listRows<WebshopProducts>(
      "app",
      "webshop_products",
      [
        Query.equal("slug", slug),
        // Same guard as `getProductBySlug`: `webshop_products` grants row read
        // to `any`, so without this a draft or archived product is reachable
        // by direct URL.
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
          "translation_refs.locale",
          "translation_refs.title",
          "translation_refs.description",
          "translation_refs.short_description",
        ]),
        Query.limit(1),
      ]
    );

    return response.rows[0] ?? null;
  } catch (error) {
    console.error("Error fetching product detail by slug:", error);
    return null;
  }
}

export async function getProductBySlug(
  slug: string,
  locale: "en" | "no"
): Promise<WebshopProducts | null> {
  try {
    const { db } = await createSessionClient();

    const response = await db.listRows<WebshopProducts>(
      "app",
      "webshop_products",
      [
        Query.equal("slug", slug),
        // `webshop_products` grants row read to `any`, so draft / pending /
        // archived products are reachable by anonymous visitors. Restrict the
        // public detail page to published products only.
        Query.equal("status", "published"),
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
        ]),
        Query.limit(1),
      ]
    );

    return response.rows[0] ?? null;
  } catch (error) {
    console.error("Error fetching product by slug:", error);
    return null;
  }
}
