import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import {
  type ContentTranslations,
  ContentTranslationsContentType,
  type News,
  NewsStatus,
  type WebshopProducts,
  WebshopProductsStatus,
} from "@repo/api/types/appwrite";
import type { Locale } from "@repo/i18n/config";

export type DepartmentTranslation = ContentTranslations & {
  news?: News[];
  products?: WebshopProducts[];
};

export async function getDepartments({
  campusId,
  isActive = true,
  locale,
}: {
  campusId?: string;
  isActive?: boolean;
  locale: Locale;
}): Promise<ContentTranslations[]> {
  const { db } = await createSessionClient();

  const queries = [
    Query.equal("content_type", ContentTranslationsContentType.DEPARTMENT),
    Query.equal("locale", locale),
    Query.select([
      "$id",
      "content_id",
      "locale",
      "title",
      "description",
      "short_description",
      "department_ref.$id",
      "department_ref.Id",
      "department_ref.Name",
      "department_ref.campus_id",
      "department_ref.logo",
      "department_ref.active",
      "department_ref.type",
      "department_ref.campus.$id",
      "department_ref.campus.name",
      "department_ref.socials.*",
      "department_ref.boardMembers.*",
    ]),
    Query.orderAsc("title"),
    Query.limit(500),
  ];

  if (isActive) {
    queries.push(Query.equal("department_ref.active", true));
  }

  if (campusId && campusId !== "all") {
    queries.push(Query.equal("department_ref.campus_id", campusId));
  }

  const departments = await db.listRows<ContentTranslations>(
    "app",
    "content_translations",
    queries
  );

  return departments.rows;
}

export async function getDepartmentById(
  id: string,
  locale: Locale
): Promise<DepartmentTranslation | null> {
  try {
    const { db } = await createSessionClient();

    // Get department translation
    const result = await db.listRows<ContentTranslations>(
      "app",
      "content_translations",
      [
        Query.equal("content_type", ContentTranslationsContentType.DEPARTMENT),
        Query.equal("content_id", id),
        Query.equal("locale", locale),
        Query.select([
          "$id",
          "content_id",
          "locale",
          "title",
          "description",
          "short_description",
          "department_ref.*",
          "department_ref.socials.*",
          "department_ref.boardMembers.*",
        ]),
      ]
    );

    if (!result.rows[0]) {
      return null;
    }

    const deptTranslation = result.rows[0];

    const newsResults = await db.listRows<News>("app", "news", [
      Query.equal("department_id", id),
      Query.equal("status", NewsStatus.PUBLISHED),
      Query.equal("translation_refs.locale", locale),
      Query.select([
        "$id",
        "$createdAt",
        "$updatedAt",
        "slug",
        "status",
        "campus_id",
        "department_id",
        "sticky",
        "url",
        "image",
        "metadata",
        "author",
        "campus.$id",
        "campus.name",
        "department.$id",
        "department.Name",
        "translation_refs.$id",
        "translation_refs.$createdAt",
        "translation_refs.$updatedAt",
        "translation_refs.locale",
        "translation_refs.title",
        "translation_refs.description",
        "translation_refs.short_description",
      ]),
      Query.orderDesc("$createdAt"),
      Query.limit(500),
    ]);

    const productsResults = await db.listRows<WebshopProducts>(
      "app",
      "webshop_products",
      [
        Query.equal("departmentId", id),
        Query.equal("status", WebshopProductsStatus.PUBLISHED),
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
          "translation_refs.$id",
          "translation_refs.$createdAt",
          "translation_refs.$updatedAt",
          "translation_refs.locale",
          "translation_refs.title",
          "translation_refs.description",
          "translation_refs.short_description",
        ]),
        Query.orderDesc("$createdAt"),
        Query.limit(500),
      ]
    );

    return {
      ...deptTranslation,
      news: newsResults.rows,
      products: productsResults.rows,
    };
  } catch (error) {
    console.error("Error fetching department:", error);
    return null;
  }
}
