"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Query } from "@repo/api";
import { createSessionClient, createAdminClient } from "@repo/api/server";
import {
  getUserAuthContext,
  type UserAuthContext,
} from "@/lib/authorization";
import { applyScopeQueries, assertWriteAccess } from "@/lib/utils/authorization";
import type {
  Jobs,
  ContentTranslations,
  Campus,
  Departments,
  JobStatus,
} from "@repo/api/types/appwrite";
import { z } from "zod";
import { jobSchema, type JobFormValues } from "./schemas";
import { JOBS_PAGE_SIZE } from "./schemas";

async function requireAuth(): Promise<UserAuthContext> {
  const ctx = await getUserAuthContext();
  if (!ctx) redirect("/auth/login");
  return ctx;
}



export async function listJobs(opts?: { campusId?: string; status?: string; search?: string; page?: number }) {
  const ctx = await requireAuth();
  const { db } = await createSessionClient();
  const page = Math.max(1, opts?.page ?? 1);

  const queries: string[] = [
    Query.orderDesc("$updatedAt"),
    Query.limit(JOBS_PAGE_SIZE),
    Query.offset((page - 1) * JOBS_PAGE_SIZE),
    ...applyScopeQueries(ctx),
  ];

  if (opts?.status && opts.status !== "all") {
    queries.push(Query.equal("status", opts.status));
  }

  if (opts?.campusId) {
    queries.push(Query.equal("campus_id", opts.campusId));
  }

  const jobsResponse = await db.listRows<Jobs>("app", "jobs", queries);
  const total = jobsResponse.total;

  const jobIds = jobsResponse.rows.map((j) => j.$id);

  let translations: ContentTranslations[] = [];
  if (jobIds.length > 0) {
    const chunkSize = 25;
    for (let i = 0; i < jobIds.length; i += chunkSize) {
      const chunk = jobIds.slice(i, i + chunkSize);
      const res = await db.listRows<ContentTranslations>(
        "app",
        "content_translations",
        [
          Query.equal("content_type", "job"),
          Query.equal("content_id", chunk),
          Query.limit(chunk.length * 2),
        ]
      );
      translations.push(...res.rows);
    }
  }

  const rows = jobsResponse.rows.map((job) => {
    const jobTranslations = translations.filter(
      (t) => t.content_id === job.$id
    );
    return { ...job, translation_refs: jobTranslations };
  });

  return { rows, total };
}

export async function getJob(id: string) {
  const ctx = await requireAuth();
  const { db } = await createSessionClient();

  const jobsResponse = await db.listRows<Jobs>("app", "jobs", [
    Query.equal("$id", id),
    Query.limit(1),
  ]);

  const job = jobsResponse.rows[0];
  if (!job) return null;

  const translationsResponse = await db.listRows<ContentTranslations>(
    "app",
    "content_translations",
    [
      Query.equal("content_type", "job"),
      Query.equal("content_id", id),
      Query.limit(10),
    ]
  );

  return { ...job, translation_refs: translationsResponse.rows };
}

export async function createJob(values: JobFormValues) {
  const ctx = await requireAuth();
  const validated = jobSchema.safeParse(values);
  if (!validated.success) {
    return { error: validated.error.flatten().fieldErrors };
  }

  assertWriteAccess(ctx, validated.data.campus_id);

  const { db } = await createSessionClient();

  const job = await db.createRow("app", "jobs", "unique()", {
    slug: validated.data.slug,
    status: "draft" as JobStatus,
    campus_id: validated.data.campus_id,
    department_id: validated.data.department_id ?? null,
    metadata: null,
  });

  for (const locale of ["no", "en"] as const) {
    await db.createRow("app", "content_translations", "unique()", {
      content_id: job.$id,
      content_type: "job",
      locale,
      title:
        locale === "no" ? validated.data.title_no : validated.data.title_en,
      description:
        locale === "no"
          ? validated.data.description_no
          : validated.data.description_en,
      additional_fields: JSON.stringify({
        employment_type: validated.data.employment_type,
        company: validated.data.company,
      }),
    });
  }

  revalidatePath("/admin/jobs");
  return { data: job.$id };
}

export async function updateJob(id: string, values: JobFormValues) {
  const ctx = await requireAuth();
  const validated = jobSchema.safeParse(values);
  if (!validated.success) {
    return { error: validated.error.flatten().fieldErrors };
  }

  const { db } = await createSessionClient();

  const existing = await db.listRows<Jobs>("app", "jobs", [
    Query.equal("$id", id),
    Query.limit(1),
  ]);
  const job = existing.rows[0];
  if (!job) return { error: "Job not found" };

  assertWriteAccess(ctx, job.campus_id, job.department_id);

  await db.updateRow("app", "jobs", id, {
    slug: validated.data.slug,
    status: validated.data.status as JobStatus,
    campus_id: validated.data.campus_id,
    department_id: validated.data.department_id ?? null,
  });

  for (const locale of ["no", "en"] as const) {
    const existingTranslation = await db.listRows<ContentTranslations>(
      "app",
      "content_translations",
      [
        Query.equal("content_type", "job"),
        Query.equal("content_id", id),
        Query.equal("locale", locale),
        Query.limit(1),
      ]
    );

    const translationData = {
      content_id: id,
      content_type: "job",
      locale,
      title:
        locale === "no" ? validated.data.title_no : validated.data.title_en,
      description:
        locale === "no"
          ? validated.data.description_no
          : validated.data.description_en,
      additional_fields: JSON.stringify({
        employment_type: validated.data.employment_type,
        company: validated.data.company,
      }),
    };

    if (existingTranslation.rows[0]) {
      await db.updateRow(
        "app",
        "content_translations",
        existingTranslation.rows[0].$id,
        translationData
      );
    } else {
      await db.createRow(
        "app",
        "content_translations",
        "unique()",
        translationData
      );
    }
  }

  revalidatePath("/admin/jobs");
  revalidatePath(`/admin/jobs/${id}`);
  return { data: id };
}

export async function deleteJob(id: string) {
  const ctx = await requireAuth();
  const { db } = await createSessionClient();

  const existing = await db.listRows<Jobs>("app", "jobs", [
    Query.equal("$id", id),
    Query.limit(1),
  ]);
  const job = existing.rows[0];
  if (!job) return { error: "Job not found" };

  assertWriteAccess(ctx, job.campus_id, job.department_id);

  const translations = await db.listRows(
    "app",
    "content_translations",
    [Query.equal("content_type", "job"), Query.equal("content_id", id)]
  );
  await Promise.all(
    translations.rows.map((t) =>
      db.deleteRow("app", "content_translations", t.$id)
    )
  );
  await db.deleteRow("app", "jobs", id);

  revalidatePath("/admin/jobs");
  return { data: true };
}

export async function listCampuses() {
  const { db } = await createSessionClient();
  const response = await db.listRows<Campus>("app", "campus", [
    Query.orderAsc("name"),
    Query.limit(50),
  ]);
  return response.rows;
}

export async function listDepartmentsForCampus(campusId: string) {
  const { db } = await createSessionClient();
  const response = await db.listRows<Departments>("app", "departments", [
    Query.equal("campus_id", campusId),
    Query.orderAsc("Name"),
    Query.limit(100),
  ]);
  return response.rows;
}
