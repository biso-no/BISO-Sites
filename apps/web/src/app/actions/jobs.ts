"use server";

import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import {
  type ContentTranslations,
  ContentType,
  type Locale,
} from "@repo/api/types/appwrite";

type ListJobsParams = {
  limit?: number;
  status?: string;
  campus?: string;
  search?: string;
  locale?: "en" | "no";
};

export async function listJobs(
  params: ListJobsParams = {}
): Promise<ContentTranslations[]> {
  const { limit = 25, status = "published", campus, locale } = params;

  try {
    const { db } = await createSessionClient();

    const queries = [
      Query.equal("content_type", ContentType.JOB),
      Query.select([
        "content_id",
        "$id",
        "locale",
        "title",
        "description",
        "short_description",
        "job_ref.*",
        "job_ref.department.*",
      ]),
      Query.limit(limit),
      Query.orderDesc("$createdAt"),
    ];

    // Only add locale filter if provided
    if (locale) {
      queries.push(Query.equal("locale", locale as Locale));
    }

    if (status !== "all") {
      queries.push(Query.equal("job_ref.status", status));
    }

    if (campus && campus !== "all") {
      queries.push(Query.equal("job_ref.campus_id", campus));
    }

    // Get jobs with their translations using Appwrite's nested relationships
    const jobsResponse = await db.listRows<ContentTranslations>(
      "app",
      "content_translations",
      queries
    );
    const jobs = jobsResponse.rows;

    return jobs;
  } catch (error) {
    console.error("Error fetching jobs:", error);
    return [];
  }
}

export async function getJobBySlug(
  slug: string,
  locale: "en" | "no"
): Promise<ContentTranslations | null> {
  try {
    const { db } = await createSessionClient();

    const response = await db.listRows<ContentTranslations>(
      "app",
      "content_translations",
      [
        Query.equal("content_type", ContentType.JOB),
        Query.equal("job_ref.slug", slug),
        Query.equal("locale", locale),
        Query.select([
          "content_id",
          "$id",
          "locale",
          "title",
          "description",
          "short_description",
          "job_ref.*",
          "job_ref.department.*",
        ]),
        Query.limit(1),
      ]
    );

    return response.rows[0] ?? null;
  } catch (error) {
    console.error("Error fetching job by slug:", error);
    return null;
  }
}
