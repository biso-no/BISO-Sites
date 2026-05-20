import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import { JobStatus, Locale } from "@repo/api/types/appwrite";
import { isRecruitmentVacancyOpen } from "@repo/shared/types/recruitment";
import { type NextRequest, NextResponse } from "next/server";
import { fetchRecruitmentListRows } from "@/lib/recruitment";

function localizeVacancy<
  T extends { translations: Array<{ locale: Locale }> },
>(vacancy: T, locale: Locale): T {
  const localizedTranslations = vacancy.translations.filter(
    (translation) => translation.locale === locale
  );

  return {
    ...vacancy,
    translations:
      localizedTranslations.length > 0
        ? localizedTranslations
        : vacancy.translations,
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { db } = await createAdminClient();
    const searchParams = request.nextUrl.searchParams;
    const locale =
      searchParams.get("locale") === Locale.NO ? Locale.NO : Locale.EN;
    const campusId = searchParams.get("campus");
    const search = searchParams.get("search")?.trim().toLowerCase() ?? "";
    const limit = Math.min(
      Number.parseInt(searchParams.get("limit") ?? "100", 10) || 100,
      100
    );

    const vacancies = await fetchRecruitmentListRows(db, [
      Query.equal("status", JobStatus.PUBLISHED),
      Query.orderDesc("$createdAt"),
      Query.limit(limit),
      ...(campusId && campusId !== "all"
        ? [Query.equal("campus_id", campusId)]
        : []),
    ]);

    const openVacancies = vacancies
      .filter((vacancy) =>
        isRecruitmentVacancyOpen(vacancy.status, vacancy.metadata)
      )
      .map((vacancy) => localizeVacancy(vacancy, locale))
      .filter((vacancy) => {
        if (!search) {
          return true;
        }

        const title = vacancy.translations[0]?.title.toLowerCase() ?? "";
        const description =
          vacancy.translations[0]?.description.toLowerCase() ?? "";
        const department = vacancy.department?.Name.toLowerCase() ?? "";

        return (
          title.includes(search) ||
          description.includes(search) ||
          department.includes(search)
        );
      });

    return NextResponse.json({
      rows: openVacancies,
      total: openVacancies.length,
    });
  } catch (error) {
    console.error("Failed to list recruitment vacancies:", error);
    const message =
      error instanceof Error ? error.message : "Failed to list vacancies";
    return NextResponse.json(
      {
        error: message,
        ...(process.env.NODE_ENV !== "production"
          ? {
              hint: "If this references unknown column(s), run `appwrite deploy collections` to apply packages/api/appwrite.config.json to your Appwrite project.",
            }
          : {}),
      },
      { status: 500 }
    );
  }
}
