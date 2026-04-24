import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import { JobStatus, Locale } from "@repo/api/types/appwrite";
import { isRecruitmentVacancyOpen } from "@repo/shared/types/recruitment";
import { type NextRequest, NextResponse } from "next/server";
import { fetchRecruitmentListRows } from "@/lib/recruitment";

function localizeVacancy<
  T extends { translation_refs: Array<{ locale: Locale }> },
>(vacancy: T, locale: Locale): T {
  const localizedTranslations = vacancy.translation_refs.filter(
    (translation) => translation.locale === locale
  );

  return {
    ...vacancy,
    translation_refs:
      localizedTranslations.length > 0
        ? localizedTranslations
        : vacancy.translation_refs,
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

        const title = vacancy.translation_refs[0]?.title.toLowerCase() ?? "";
        const description =
          vacancy.translation_refs[0]?.description.toLowerCase() ?? "";
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
    return NextResponse.json(
      { error: "Failed to list vacancies" },
      { status: 500 }
    );
  }
}
