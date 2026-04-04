"use server";

import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import type { Locale, WebshopProducts } from "@repo/api/types/appwrite";

interface ListProductsParams {
  campus?: string;
  category?: string;
  limit?: number;
  locale?: "en" | "no";
  memberOnly?: boolean;
  status?: string;
}

interface CreateProductData {
  campus_id: string;
  category: string;
  image?: string;
  member_only?: boolean;
  member_price?: number;
  metadata?: {
    product_options?: Array<{
      type: "select" | "input";
      label: string;
      required: boolean;
      options?: string[];
      placeholder?: string;
    }>;
  };
  regular_price: number;
  slug: string;
  status: "draft" | "published" | "closed";
  stock?: number;
  translations: {
    en?: {
      title: string;
      description: string;
      short_description?: string;
    };
    no?: {
      title: string;
      description: string;
      short_description?: string;
    };
  };
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
      queries.push(Query.equal("translation_refs.locale", locale as Locale));
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
        Query.equal("translation_refs.locale", locale as Locale),
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
