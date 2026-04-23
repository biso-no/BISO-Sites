import { Query } from "@repo/api";
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
  getRecruitmentJobById,
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

  await db.createRow("app", "content_translations", "unique()", data);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const scope = await getAdminScope(request);
    if (!scope) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const { db } = await createAdminClient();
    const lookups = await loadRecruitmentLookups(db);
    const vacancy = await getRecruitmentJobById(db, id);

    if (!vacancy) {
      return NextResponse.json({ error: "Vacancy not found" }, { status: 404 });
    }

    assertRecruitmentVacancyWriteAccess(scope, lookups, vacancy);
    return NextResponse.json({ row: vacancy });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch vacancy",
      },
      {
        status:
          error instanceof Error && error.message === "Forbidden" ? 403 : 500,
      }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const scope = await getAdminScope(request);
    if (!scope) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
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
    const vacancy = await getRecruitmentJobById(db, id);

    if (!vacancy) {
      return NextResponse.json({ error: "Vacancy not found" }, { status: 404 });
    }

    assertRecruitmentVacancyWriteAccess(scope, lookups, vacancy);
    assertRecruitmentVacancyWriteAccess(scope, lookups, {
      campus_id: payload.data.campus_id,
      department_id: payload.data.department_id ?? null,
    });

    const metadata = mergeRecruitmentVacancyMetadata(vacancy, payload.data);

    await db.updateRow("app", "jobs", id, {
      campus_id: payload.data.campus_id,
      department_id: payload.data.department_id ?? null,
      metadata: serializeRecruitmentVacancyMetadata(metadata),
      slug: payload.data.slug,
      status: payload.data.status,
    });

    await Promise.all([
      upsertTranslation(db, id, "no", {
        description: payload.data.description_no,
        shortDescription: payload.data.short_description ?? null,
        title: payload.data.title_no,
      }),
      upsertTranslation(db, id, "en", {
        description: payload.data.description_en,
        shortDescription: payload.data.short_description ?? null,
        title: payload.data.title_en,
      }),
    ]);

    await createAuditLog({
      action: "recruitment.vacancy.update",
      actorId: scope.userId,
      payload: {
        campus_id: payload.data.campus_id,
        department_id: payload.data.department_id ?? null,
        status: payload.data.status,
      },
      resourceId: id,
      resourceType: "job",
    });

    return NextResponse.json({ data: { $id: id } });
  } catch (error) {
    console.error("Failed to update recruitment vacancy:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update vacancy",
      },
      {
        status:
          error instanceof Error && error.message === "Forbidden" ? 403 : 500,
      }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const scope = await getAdminScope(request);
    if (!scope) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const { db } = await createAdminClient();
    const lookups = await loadRecruitmentLookups(db);
    const vacancy = await getRecruitmentJobById(db, id);

    if (!vacancy) {
      return NextResponse.json({ error: "Vacancy not found" }, { status: 404 });
    }

    assertRecruitmentVacancyWriteAccess(scope, lookups, vacancy);

    const applications = await db.listRows("app", "job_applications", [
      Query.equal("job_id", id),
      Query.limit(1),
    ]);

    if (applications.total > 0) {
      return NextResponse.json(
        { error: "Vacancies with applications cannot be deleted" },
        { status: 409 }
      );
    }

    const translations = await db.listRows<ContentTranslations>(
      "app",
      "content_translations",
      [
        Query.equal("content_type", "job"),
        Query.equal("content_id", id),
        Query.limit(10),
      ]
    );

    await Promise.all(
      translations.rows.map((translation) =>
        db.deleteRow("app", "content_translations", translation.$id)
      )
    );
    await db.deleteRow("app", "jobs", id);

    await createAuditLog({
      action: "recruitment.vacancy.delete",
      actorId: scope.userId,
      resourceId: id,
      resourceType: "job",
    });

    return NextResponse.json({ data: true });
  } catch (error) {
    console.error("Failed to delete recruitment vacancy:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to delete vacancy",
      },
      {
        status:
          error instanceof Error && error.message === "Forbidden" ? 403 : 500,
      }
    );
  }
}
