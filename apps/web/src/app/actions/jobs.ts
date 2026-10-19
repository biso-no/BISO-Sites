"use server";

import { extractTextFromPdf } from "@repo/ai/server/pdf-text-extractor";
import { screenApplication } from "@repo/ai/server/recruitment-screener";
import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import type { Jobs } from "@repo/api/types/appwrite";
import {
  fetchRecruitmentListPage,
  getRecruitmentJobBySlug,
  isAuthenticatedAppwriteUser,
  localizeVacancy,
} from "@repo/shared/recruitment";
import {
  listApplicationsForApplicant,
  type MyApplicationView,
  type RecruitmentApplicant,
  runRecruitmentScreening,
  submitRecruitmentApplication,
} from "@repo/shared/recruitment/apply";
import {
  isRecruitmentVacancyOpen,
  type RecruitmentVacancy,
} from "@repo/shared/types/recruitment";
import {
  parseUnitCategory,
  UNIT_CATEGORIES,
  type UnitCategory,
} from "@repo/shared/utils/unit-categories";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { cache } from "react";
import { getLiveMembershipStatus } from "@/lib/actions/membership";
import { campusScopeIds } from "@/lib/campus-scope";
import { openVacancyQueries } from "@/lib/data/queries";
import { findContentIdsBySearch } from "@/lib/data/search-content";
import {
  emptyWebResult,
  WEB_PAGE_SIZE,
  type WebPaginatedResult,
} from "@/lib/list-params";

// ---------- public reads (session/guest client — enforces row permissions) ----------

export type JobSort = "deadline" | "newest";

// Primitive arguments only: React cache() keys on argument identity
// (Object.is), so an options object allocated fresh at each call site would
// never hit the memo. See WEB_APP_APPWRITE_INCIDENT_AUDIT.md (F-6b).
// `pageSize` is threaded as its own primitive argument for the same reason —
// bundling it into an options object would silently kill the memo.
const _listJobs = cache(
  async (
    campus: string | null,
    department: string | null,
    category: string | null,
    locale: string,
    page: number,
    search: string,
    sort: JobSort,
    pageSize: number
  ): Promise<WebPaginatedResult<RecruitmentVacancy>> => {
    try {
      const { db } = await createSessionClient();

      let capped = false;
      const idQueries: string[] = [];
      if (search.trim()) {
        const found = await findContentIdsBySearch(db, "job", search, locale);
        if (found.ids.length === 0) {
          return emptyWebResult<RecruitmentVacancy>(page, pageSize);
        }
        capped = found.capped;
        idQueries.push(Query.equal("$id", found.ids));
      }

      const queries: string[] = [
        ...openVacancyQueries(),
        ...idQueries,
        sort === "deadline"
          ? Query.orderAsc("application_deadline")
          : Query.orderDesc("$createdAt"),
        Query.limit(pageSize),
        Query.offset((page - 1) * pageSize),
      ];

      const campusScope = campusScopeIds(campus);
      if (campusScope) {
        queries.push(Query.equal("campus_id", campusScope));
      }
      if (department) {
        queries.push(Query.equal("department_id", department));
      }
      if (category) {
        // Filter operators traverse relationships (verified); ordering does
        // not, which is why there is no A-Z sort.
        queries.push(Query.equal("department.type", category));
      }

      const { rows, total } = await fetchRecruitmentListPage(db, queries);

      return {
        rows: rows.map((v) => localizeVacancy(v, locale)),
        total,
        page,
        size: pageSize,
        capped,
      };
    } catch (error) {
      console.error("listJobs failed:", error);
      return emptyWebResult<RecruitmentVacancy>(page, pageSize);
    }
  }
);

// biome-ignore lint/suspicious/useAwait: async required by "use server" — returns cached promise
export async function listJobs(params: {
  campus?: string | null;
  category?: string | null;
  department?: string | null;
  locale?: string;
  page?: number;
  /**
   * Rows per page. Defaults to `WEB_PAGE_SIZE` (12) — the paginated `/jobs`
   * surface should omit this so it keeps the size its load-more UI expects.
   * First-N consumers (`/students`) that need a bigger pool in one fetch pass
   * this explicitly.
   */
  pageSize?: number;
  search?: string;
  sort?: JobSort;
}): Promise<WebPaginatedResult<RecruitmentVacancy>> {
  return _listJobs(
    params.campus ?? null,
    params.department ?? null,
    params.category ?? null,
    params.locale ?? "en",
    params.page ?? 1,
    params.search ?? "",
    params.sort ?? "newest",
    params.pageSize ?? WEB_PAGE_SIZE
  );
}

/**
 * Filter options drawn from the whole filtered set, not the current page.
 *
 * Building the dropdowns from page 1 would offer twelve rows' worth of
 * options. Two cheap projections over the open set (28 rows today) give the
 * true lists, and the department count doubles as the hero's stat.
 */
export async function listJobFacets(params: {
  campus?: string | null;
}): Promise<{ categories: UnitCategory[]; departments: [string, string][] }> {
  try {
    const { db } = await createSessionClient();
    const queries = [
      ...openVacancyQueries(),
      Query.select([
        "$id",
        "department_id",
        "department.$id",
        "department.Name",
        "department.type",
      ]),
      Query.limit(300),
    ];
    const campusScope = campusScopeIds(params.campus ?? null);
    if (campusScope) {
      queries.push(Query.equal("campus_id", campusScope));
    }

    const response = await db.listRows<Jobs>("app", "jobs", queries);

    const departments = new Map<string, string>();
    const categories = new Set<UnitCategory>();
    for (const job of response.rows) {
      const dept = job.department as
        | { $id?: string; Name?: string; type?: string | null }
        | null
        | undefined;
      if (job.department_id && dept?.Name) {
        departments.set(job.department_id, dept.Name);
      }
      const parsed = parseUnitCategory(dept?.type);
      if (parsed) {
        categories.add(parsed);
      }
    }

    return {
      // Ordered by the canonical list so the chips never reshuffle between
      // renders; only categories actually present are offered.
      categories: UNIT_CATEGORIES.filter((c) => categories.has(c)),
      // Appwrite's row order is not stable across renders; sort in JS so the
      // department dropdown doesn't reshuffle for no visible reason. (The
      // "cannot order by nested attribute" restriction is on Appwrite's
      // orderAsc, not on sorting already-fetched values.)
      departments: [...departments.entries()].sort(([, a], [, b]) =>
        a.localeCompare(b)
      ),
    };
  } catch (error) {
    console.error("listJobFacets failed:", error);
    return { categories: [], departments: [] };
  }
}

const _getJobBySlug = cache(
  async (slug: string, locale: string): Promise<RecruitmentVacancy | null> => {
    try {
      const { db } = await createSessionClient();
      const vacancy = await getRecruitmentJobBySlug(db, slug);
      if (
        !(
          vacancy &&
          isRecruitmentVacancyOpen(vacancy.status, vacancy.application_deadline)
        )
      ) {
        return null;
      }
      return localizeVacancy(vacancy, locale);
    } catch (error) {
      console.error("getJobBySlug failed:", error);
      return null;
    }
  }
);

// biome-ignore lint/suspicious/useAwait: async required by "use server" — returns cached promise
export async function getJobBySlug(
  slug: string,
  locale: "en" | "no"
): Promise<RecruitmentVacancy | null> {
  return _getJobBySlug(slug, locale);
}

// ---------- application submission (session auth + admin writes) ----------

// The flow itself lives in @repo/shared/recruitment/apply, shared with the
// app's /api/recruitment/applications route; these wrappers supply the
// session's applicant and keep the shapes the apply form and
// /applications page read.

export async function submitJobApplication(
  jobId: string,
  formData: FormData
): Promise<
  { success: true; applicationId: string } | { success: false; error: string }
> {
  let applicant: RecruitmentApplicant;
  try {
    const { account } = await createSessionClient();
    const user = await account.get().catch(() => null);
    if (!(user && isAuthenticatedAppwriteUser(user) && user.email)) {
      return {
        success: false,
        error: "You must sign in with a verified account before applying.",
      };
    }
    applicant = { email: user.email, name: user.name, userId: user.$id };
  } catch (error) {
    console.error("submitJobApplication failed:", error);
    return { success: false, error: "Failed to submit application." };
  }

  const result = await submitRecruitmentApplication(
    { applicant, formData, jobId },
    {
      extractPdfText: extractTextFromPdf,
      // Live (uncached) status: a student who paid for their membership a
      // moment ago must be able to apply straight away.
      isMember: async () => (await getLiveMembershipStatus()).isMember,
    }
  );
  if (!result.success) {
    return { success: false, error: result.error };
  }

  const { screening } = result;
  if (screening) {
    after(() => runRecruitmentScreening(screening, screenApplication));
  }

  revalidatePath("/applications");
  revalidatePath("/jobs");
  return { success: true, applicationId: result.applicationId };
}

// ---------- candidate "my applications" ----------

export type { MyApplicationView } from "@repo/shared/recruitment/apply";

export async function listMyApplications(): Promise<MyApplicationView[]> {
  try {
    const { account } = await createSessionClient();
    const user = await account.get().catch(() => null);
    if (!(user && isAuthenticatedAppwriteUser(user) && user.email)) {
      return [];
    }
    return await listApplicationsForApplicant(user.email);
  } catch (error) {
    console.error("listMyApplications failed:", error);
    return [];
  }
}
