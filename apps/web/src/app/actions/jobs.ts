"use server";

import { Locale } from "@repo/api/types/appwrite";
import type { RecruitmentVacancy } from "@repo/shared/types/recruitment";
import { createJWT, getLoggedInUser } from "@/lib/actions/user";

const API_BASE_URL =
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:3003";

async function fetchRecruitmentJson<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    // Surface the upstream message so 5xx debugging doesn't lose the cause.
    let detail = "";
    try {
      const body = (await response.json()) as {
        error?: string;
        hint?: string;
      };
      if (body?.error) {
        detail = ` — ${body.error}`;
      }
      if (body?.hint) {
        detail += ` (${body.hint})`;
      }
    } catch {
      // ignore parse failure; keep the raw status
    }
    throw new Error(`Recruitment API error: ${response.status}${detail}`);
  }

  return response.json() as Promise<T>;
}

interface ListJobsParams {
  campus?: string;
  limit?: number;
  locale?: Locale | "en" | "no";
  search?: string;
  status?: string;
}

export async function listJobs(
  params: ListJobsParams = {}
): Promise<RecruitmentVacancy[]> {
  const searchParams = new URLSearchParams();
  searchParams.set("limit", String(params.limit ?? 25));
  searchParams.set("locale", String(params.locale ?? Locale.EN));

  if (params.campus) {
    searchParams.set("campus", params.campus);
  }

  if (params.search?.trim()) {
    searchParams.set("search", params.search.trim());
  }

  try {
    const response = await fetchRecruitmentJson<{
      rows: RecruitmentVacancy[];
      total: number;
    }>(`/api/recruitment/vacancies?${searchParams.toString()}`);

    return response.rows;
  } catch (error) {
    console.error("Error fetching recruitment vacancies:", error);
    return [];
  }
}

export async function getJobBySlug(
  slug: string,
  locale: Locale | "en" | "no"
): Promise<RecruitmentVacancy | null> {
  try {
    const response = await fetchRecruitmentJson<{
      row: RecruitmentVacancy;
    }>(`/api/recruitment/vacancies/${slug}?locale=${locale}`);

    return response.row;
  } catch (error) {
    console.error("Error fetching recruitment vacancy by slug:", error);
    return null;
  }
}

export interface MyApplicationView {
  $id: string;
  $createdAt: string;
  status: "submitted" | "reviewed" | "interview" | "accepted" | "rejected";
  data_retention_until: string;
  cover_letter: string | null;
  resume_file_id: string | null;
  job: {
    $id: string;
    slug: string;
    title: string;
    campus_name: string | null;
  } | null;
  next_interview: {
    $id: string;
    starts_at: string | null;
    ends_at: string | null;
    title: string;
    location: string | null;
    meeting_url: string | null;
    status: "proposed" | "scheduled" | "completed" | "cancelled" | "no_show";
  } | null;
  answers: Array<{ question_label: string; answer: string | null }>;
  hr_assigned_name: string | null;
}

export async function listMyApplications(): Promise<MyApplicationView[]> {
  try {
    const jwt = await createJWT();
    if (!jwt) {
      return [];
    }
    const response = await fetch(
      `${API_BASE_URL}/api/recruitment/applications/me`,
      {
        cache: "no-store",
        headers: { Authorization: `Bearer ${jwt}` },
      }
    );
    if (!response.ok) {
      return [];
    }
    const payload = (await response.json()) as {
      rows?: MyApplicationView[];
    };
    return payload.rows ?? [];
  } catch (error) {
    console.error("Error fetching my applications:", error);
    return [];
  }
}

export async function submitJobApplication(
  jobId: string,
  formData: FormData
): Promise<
  { success: true; applicationId: string } | { success: false; error: string }
> {
  try {
    const loggedInUser = await getLoggedInUser();
    if (!loggedInUser?.user.email) {
      return {
        success: false,
        error: "You must sign in with a verified account before applying.",
      };
    }

    const jwt = await createJWT();
    if (!jwt) {
      return {
        success: false,
        error: "Could not authenticate your application request.",
      };
    }

    formData.set("applicant_email", loggedInUser.user.email);
    if (!formData.get("applicant_name") && loggedInUser.user.name) {
      formData.set("applicant_name", loggedInUser.user.name);
    }

    const response = await fetch(
      `${API_BASE_URL}/api/recruitment/vacancies/${jobId}/applications`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
        body: formData,
        cache: "no-store",
      }
    );

    const payload = (await response.json().catch(() => null)) as {
      data?: { $id: string };
      error?: string;
    } | null;

    if (!response.ok) {
      return {
        success: false,
        error: payload?.error ?? "Failed to submit application.",
      };
    }

    return {
      success: true,
      applicationId: payload?.data?.$id ?? "",
    };
  } catch (error) {
    console.error("Error submitting recruitment application:", error);
    return {
      success: false,
      error: "Failed to submit application.",
    };
  }
}
