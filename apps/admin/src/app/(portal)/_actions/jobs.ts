"use server";

import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import type { Campus, Departments } from "@repo/api/types/appwrite";
import type {
  RecruitmentApplicationRecord,
  RecruitmentApplicationStatusUpdateInput,
  RecruitmentVacancy,
  RecruitmentVacancyUpsertInput,
} from "@repo/shared/types/recruitment";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createJWT } from "@/lib/actions/user";
import { getUserAuthContext } from "@/lib/authorization";

const API_BASE_URL =
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:3003";

async function requireAuth() {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    redirect("/auth/login");
  }
  return ctx;
}

async function fetchRecruitmentApi<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const jwt = await createJWT();
  if (!jwt) {
    throw new Error("Unauthorized");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${jwt}`,
      ...(init?.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...(init?.headers ?? {}),
    },
  });

  const payload = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;

  if (!response.ok) {
    throw new Error(
      payload?.error || `Recruitment API error: ${response.status}`
    );
  }

  return payload as T;
}

export async function listJobs(opts?: {
  status?: string;
  search?: string;
  page?: number;
}) {
  await requireAuth();
  const searchParams = new URLSearchParams();
  searchParams.set("page", String(opts?.page ?? 1));

  if (opts?.status) {
    searchParams.set("status", opts.status);
  }

  if (opts?.search?.trim()) {
    searchParams.set("search", opts.search.trim());
  }

  return fetchRecruitmentApi<{
    page: number;
    pageSize: number;
    rows: RecruitmentVacancy[];
    total: number;
  }>(`/api/admin/recruitment/vacancies?${searchParams.toString()}`);
}

export async function getJob(id: string) {
  await requireAuth();
  const response = await fetchRecruitmentApi<{ row: RecruitmentVacancy }>(
    `/api/admin/recruitment/vacancies/${id}`
  );
  return response.row;
}

export async function createJob(values: RecruitmentVacancyUpsertInput) {
  await requireAuth();

  try {
    const response = await fetchRecruitmentApi<{ data: { $id: string } }>(
      "/api/admin/recruitment/vacancies",
      {
        body: JSON.stringify(values),
        method: "POST",
      }
    );

    revalidatePath("/jobs");
    revalidatePath("/");
    return { data: response.data.$id };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to create job",
    };
  }
}

export async function updateJob(
  id: string,
  values: RecruitmentVacancyUpsertInput
) {
  await requireAuth();

  try {
    const response = await fetchRecruitmentApi<{ data: { $id: string } }>(
      `/api/admin/recruitment/vacancies/${id}`,
      {
        body: JSON.stringify(values),
        method: "PATCH",
      }
    );

    revalidatePath("/jobs");
    revalidatePath(`/jobs/${id}`);
    return { data: response.data.$id };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to update job",
    };
  }
}

export async function deleteJob(id: string) {
  await requireAuth();

  try {
    await fetchRecruitmentApi(`/api/admin/recruitment/vacancies/${id}`, {
      method: "DELETE",
    });
    revalidatePath("/jobs");
    return { data: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to delete job",
    };
  }
}

export async function listJobApplications(opts?: {
  jobId?: string;
  page?: number;
  search?: string;
  status?: string;
}) {
  await requireAuth();
  const searchParams = new URLSearchParams();
  searchParams.set("page", String(opts?.page ?? 1));

  if (opts?.jobId) {
    searchParams.set("jobId", opts.jobId);
  }

  if (opts?.status) {
    searchParams.set("status", opts.status);
  }

  if (opts?.search?.trim()) {
    searchParams.set("search", opts.search.trim());
  }

  return fetchRecruitmentApi<{
    page: number;
    pageSize: number;
    rows: RecruitmentApplicationRecord[];
    total: number;
  }>(`/api/admin/recruitment/applications?${searchParams.toString()}`);
}

export async function getJobApplication(id: string) {
  await requireAuth();
  const response = await fetchRecruitmentApi<{
    row: RecruitmentApplicationRecord;
  }>(`/api/admin/recruitment/applications/${id}`);
  return response.row;
}

export async function updateJobApplicationStatus(
  id: string,
  values: RecruitmentApplicationStatusUpdateInput
) {
  await requireAuth();

  try {
    const response = await fetchRecruitmentApi<{
      data: { $id: string; status: string };
    }>(`/api/admin/recruitment/applications/${id}`, {
      body: JSON.stringify(values),
      method: "PATCH",
    });

    revalidatePath("/jobs/applications");
    return { data: response.data };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to update application",
    };
  }
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
