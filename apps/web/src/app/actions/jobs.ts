"use server";

import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import type { Jobs, Locale } from "@repo/api/types/appwrite";

function filterTranslationRefs<T extends { translation_refs?: unknown }>(
  item: T,
  locale: string | undefined
): T {
  if (!locale || !Array.isArray(item.translation_refs)) {
    return item;
  }
  return {
    ...item,
    translation_refs: item.translation_refs.filter(
      (ref) =>
        typeof ref === "object" &&
        ref !== null &&
        "locale" in ref &&
        (ref as Record<string, unknown>).locale === locale
    ),
  };
}

interface ListJobsParams {
  campus?: string;
  limit?: number;
  locale?: "en" | "no";
  search?: string;
  status?: string;
}

export async function listJobs(params: ListJobsParams = {}): Promise<Jobs[]> {
  const { limit = 25, status = "published", campus, locale, search } = params;

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
        "department_id",
        "metadata",
        "campus.$id",
        "campus.name",
        "department.$id",
        "department.Name",
        "department.campus_id",
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

    if (search?.trim()) {
      queries.push(Query.search("translation_refs.title", search.trim()));
    }

    const jobsResponse = await db.listRows<Jobs>("app", "jobs", queries);

    return jobsResponse.rows.map((item) => filterTranslationRefs(item, locale));
  } catch (error) {
    console.error("Error fetching jobs:", error);
    return [];
  }
}

export async function getJobBySlug(
  slug: string,
  locale: "en" | "no"
): Promise<Jobs | null> {
  try {
    const { db } = await createSessionClient();

    const response = await db.listRows<Jobs>("app", "jobs", [
      Query.equal("slug", slug),
      Query.equal("translation_refs.locale", locale as Locale),
      Query.select([
        "$id",
        "$createdAt",
        "$updatedAt",
        "slug",
        "status",
        "campus_id",
        "department_id",
        "metadata",
        "campus.$id",
        "campus.name",
        "department.$id",
        "department.Name",
        "department.campus_id",
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
    ]);

    const item = response.rows[0];
    return item ? filterTranslationRefs(item, locale) : null;
  } catch (error) {
    console.error("Error fetching job by slug:", error);
    return null;
  }
}
