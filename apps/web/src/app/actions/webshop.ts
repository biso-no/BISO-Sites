"use server";

import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import type { WebshopProducts } from "@repo/api/types/appwrite";
import { listedProductsOnly } from "@/lib/data/product-visibility";

interface ListProductsParams {
  campus?: string;
  category?: string;
  limit?: number;
  locale?: "en" | "no";
}

export async function listProducts(
  params: ListProductsParams = {}
): Promise<WebshopProducts[]> {
  const { limit = 50, campus, category, locale } = params;

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
      // Both filters are unconditional and deliberately NOT caller-supplied.
      // This is a server action, so it is an ordinary POST endpoint the browser
      // can call with any arguments it likes: anything reachable through a
      // parameter is reachable by anyone. `status` used to be exactly that, and
      // passing `"all"` dropped the filter — on a table that grants read to
      // `any`, that enumerated every draft with its title, price, stock and
      // owning department.
      //
      // No `member_only` filter, though, deliberately and for everyone:
      // members-only limits who can BUY a product, not who can see it. The card
      // renders a badge (the column stays projected above so it can) and the
      // purchase is refused server-side.
      //
      // Link-only products stay reachable at `/shop/<slug>` — see
      // `getProductBySlug`, which filters on status but not on `unlisted`.
      Query.equal("status", "published"),
      listedProductsOnly(),
    ];

    if (locale) {
      queries.push(Query.equal("translation_refs.locale", locale));
    }

    if (campus && campus !== "all") {
      queries.push(Query.equal("campus_id", campus));
    }

    if (category && category !== "all") {
      queries.push(Query.equal("category", category));
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
          // Read so `generateMetadata` can mark a link-only product `noindex`.
          "unlisted",
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
          // Checkout questions for this product, rendered by the storefront and
          // validated again server-side in app/actions/orders.ts.
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
