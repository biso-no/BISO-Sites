import { ID, Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type { ContentTranslations } from "@repo/api/types/appwrite";
import {
  recruitmentVacancyUpsertSchema,
  serializeRecruitmentVacancyMetadata,
} from "@repo/shared/types/recruitment";
import { type NextRequest, NextResponse } from "next/server";
import { createAuditLog, getAdminScope } from "@/lib/admin-auth";
import {
  assertRecruitmentVacancyWriteAccess,
  canManageRecruitmentVacancy,
  fetchRecruitmentListRows,
  loadRecruitmentLookups,
  mergeRecruitmentVacancyMetadata,
} from "@/lib/recruitment";

async function upsertTranslation(
  db: Awaited<ReturnType<typeof createAdminClient>>["db"],
  jobId: string,
  locale: "no" | "en",
  payload: {
    description: string;
    shortDescription: string | null;
    title: string;
  }
): Promise<void> {
  const existing = await db.listRows<ContentTranslations>(
    "app",
    "content_translations",
    [
      Query.equal("content_type", "job"),
      Query.equal("content_id", jobId),
      Query.equal("locale", locale),
      Query.limit(1),
    ]
  );

  const data = {
    additional_fields: null,
    content_id: jobId,
    content_type: "job",
    description: payload.description,
    locale,
    short_description: payload.shortDescription,
    title: payload.title,
  };

  if (existing.rows[0]) {
    await db.updateRow(
      "app",
      "content_translations",
      existing.rows[0].$id,
      data
    );
    return;
  }

  await db.createRow("app", "content_translations", ID.unique(), data);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const scope = await getAdminScope(request);
    if (!scope) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { db } = await createAdminClient();
    const lookups = await loadRecruitmentLookups(db);
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(
      Number.parseInt(searchParams.get("page") ?? "1", 10) || 1,
      1
    );
    const pageSize = 20;
    const search = searchParams.get("search")?.trim().toLowerCase() ?? "";
    const status = searchParams.get("status");

    const vacancies = await fetchRecruitmentListRows(db, [
      Query.orderDesc("$updatedAt"),
      Query.limit(200),
    ]);

    const filtered = vacancies
      .filter((vacancy) => canManageRecruitmentVacancy(scope, lookups, vacancy))
      .filter((vacancy) =>
        status && status !== "all" ? vacancy.status === status : true
      )
      .filter((vacancy) => {
        if (!search) {
          return true;
        }

        const title =
          vacancy.translation_refs
            .find((translation) => translation.locale === "no")
            ?.title.toLowerCase() ?? "";
        const company =
          typeof vacancy.metadata.company === "string"
            ? vacancy.metadata.company.toLowerCase()
            : "";

        return title.includes(search) || company.includes(search);
      });

    const start = (page - 1) * pageSize;
    const rows = filtered.slice(start, start + pageSize);

    return NextResponse.json({
      page,
      pageSize,
      rows,
      total: filtered.length,
    });
  } catch (error) {
    console.error("Failed to list admin recruitment vacancies:", error);
    return NextResponse.json(
      { error: "Failed to list vacancies" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const scope = await getAdminScope(request);
    if (!scope) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = recruitmentVacancyUpsertSchema.safeParse(
      await request.json()
    );
    if (!payload.success) {
      return NextResponse.json(
        { error: "Invalid vacancy payload", details: payload.error.flatten() },
        { status: 400 }
      );
    }

    const { db } = await createAdminClient();
    const lookups = await loadRecruitmentLookups(db);

    assertRecruitmentVacancyWriteAccess(scope, lookups, {
      campus_id: payload.data.campus_id,
      department_id: payload.data.department_id ?? null,
    });

    const metadata = mergeRecruitmentVacancyMetadata(null, payload.data);
    const job = await db.createRow("app", "jobs", ID.unique(), {
      campus_id: payload.data.campus_id,
      department_id: payload.data.department_id ?? null,
      metadata: serializeRecruitmentVacancyMetadata(metadata),
      slug: payload.data.slug,
      status: payload.data.status,
    });

    await Promise.all([
      upsertTranslation(db, job.$id, "no", {
        description: payload.data.description_no,
        shortDescription: payload.data.short_description ?? null,
        title: payload.data.title_no,
      }),
      upsertTranslation(db, job.$id, "en", {
        description: payload.data.description_en,
        shortDescription: payload.data.short_description ?? null,
        title: payload.data.title_en,
      }),
    ]);

    await createAuditLog({
      action: "recruitment.vacancy.create",
      actorId: scope.userId,
      payload: {
        campus_id: payload.data.campus_id,
        department_id: payload.data.department_id ?? null,
        status: payload.data.status,
      },
      resourceId: job.$id,
      resourceType: "job",
    });

    return NextResponse.json({ data: { $id: job.$id } }, { status: 201 });
  } catch (error) {
    console.error("Failed to create recruitment vacancy:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create vacancy",
      },
      {
        status:
          error instanceof Error && error.message === "Forbidden" ? 403 : 500,
      }
    );
  }
}
