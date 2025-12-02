"use server";

import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import {
  type ContentTranslations,
  ContentType,
  Locale,
} from "@repo/api/types/appwrite";


type ListProductsParams = {
  limit?: number;
  status?: string;
  campus?: string;
  category?: string;
  locale?: "en" | "no";
  memberOnly?: boolean;
};

type CreateProductData = {
  slug: string;
  status: "draft" | "published" | "closed";
  campus_id: string;
  category: string;
  regular_price: number;
  member_price?: number;
  member_only?: boolean;
  image?: string;
  stock?: number;
  metadata?: {
    product_options?: Array<{
      type: "select" | "input";
      label: string;
      required: boolean;
      options?: string[];
      placeholder?: string;
    }>;
  };
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
};

export async function listProducts(
  params: ListProductsParams = {}
): Promise<ContentTranslations[]> {
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
      Query.equal("content_type", ContentType.PRODUCT),
      Query.select([
        "content_id",
        "$id",
        "locale",
        "title",
        "description",
        "short_description",
        "product_ref.*",
      ]),
      Query.equal("locale", locale as Locale),
      Query.limit(limit),
      Query.orderDesc("$createdAt"),
    ];

    if (status !== "all") {
      queries.push(Query.equal("product_ref.status", status));
    }

    if (campus && campus !== "all") {
      queries.push(Query.equal("product_ref.campus_id", campus));
    }

    if (category && category !== "all") {
      queries.push(Query.equal("product_ref.category", category));
    }

    if (memberOnly !== undefined) {
      queries.push(Query.equal("product_ref.member_only", memberOnly));
    }

    const productsResponse = await db.listRows<ContentTranslations>(
      "app",
      "content_translations",
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
): Promise<ContentTranslations | null> {
  try {
    const { db } = await createSessionClient();

    const translationsResponse = await db.listRows<ContentTranslations>(
      "app",
      "content_translations",
      [
        Query.equal("content_type", ContentType.PRODUCT),
        Query.equal("locale", locale as Locale),
        Query.equal("product_ref.slug", slug),
        Query.select([
          "content_id",
          "$id",
          "locale",
          "title",
          "description",
          "short_description",
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
    console.error("Error fetching product by slug:", error);
    return null;
  }
}
