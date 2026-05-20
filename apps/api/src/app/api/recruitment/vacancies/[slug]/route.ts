import { createAdminClient } from "@repo/api/server";
import { Locale } from "@repo/api/types/appwrite";
import { isRecruitmentVacancyOpen } from "@repo/shared/types/recruitment";
import { type NextRequest, NextResponse } from "next/server";
import { getRecruitmentJobBySlug } from "@/lib/recruitment";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  try {
    const { slug } = await context.params;
    const locale =
      request.nextUrl.searchParams.get("locale") === Locale.NO
        ? Locale.NO
        : Locale.EN;
    const { db } = await createAdminClient();

    const vacancy = await getRecruitmentJobBySlug(db, slug);
    if (
      !(vacancy && isRecruitmentVacancyOpen(vacancy.status, vacancy.metadata))
    ) {
      return NextResponse.json({ error: "Vacancy not found" }, { status: 404 });
    }

    const localizedTranslations = vacancy.translations.filter(
      (translation) => translation.locale === locale
    );

    return NextResponse.json({
      row: {
        ...vacancy,
        translations:
          localizedTranslations.length > 0
            ? localizedTranslations
            : vacancy.translations,
      },
    });
  } catch (error) {
    console.error("Failed to get recruitment vacancy:", error);
    return NextResponse.json(
      { error: "Failed to fetch vacancy" },
      { status: 500 }
    );
  }
}
