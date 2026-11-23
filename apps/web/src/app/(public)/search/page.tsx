import {
  emptyPageResponse,
  type PageSearchResponse,
} from "@repo/shared/search/response";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { getLocale } from "@/app/actions/locale";
import { SearchResultsPage } from "@/components/search/search-results-page";
import { FeedSkeleton } from "@/components/ui/loading-shell";
import { getUserPreferences } from "@/lib/auth-utils";
import { resolveRequestCampus } from "@/lib/campus-scope";
import { fetchSearch, SearchUnavailableError } from "@/lib/search/fetch";
import {
  parseSearchPageParams,
  type SearchPageParams,
} from "@/lib/search/page-params";

const SERVER_TIMEOUT_MS = 8000;

export async function generateMetadata() {
  const t = await getTranslations("search");
  return {
    title: t("page.metaTitle"),
    // Result pages are endless query variations, not content to index.
    robots: { follow: true, index: false },
    alternates: { canonical: "/search" },
  };
}

async function SearchResults({
  campusId,
  locale,
  params,
}: {
  campusId: string | null;
  locale: "no" | "en";
  params: SearchPageParams;
}) {
  await connection();
  let response: PageSearchResponse | null = null;
  let error = false;
  if (params.q) {
    try {
      response = await fetchSearch(
        {
          q: params.q,
          locale,
          mode: "page",
          group: params.group,
          page: params.page,
          campus: campusId,
          onlyCampus: params.onlyCampus,
        },
        { timeoutMs: SERVER_TIMEOUT_MS }
      );
    } catch (caught) {
      if (!(caught instanceof SearchUnavailableError)) {
        throw caught;
      }
      error = true;
    }
  } else {
    response = emptyPageResponse("", locale, params.group);
  }
  return (
    <SearchResultsPage
      campusId={campusId}
      error={error}
      locale={locale}
      params={params}
      response={response}
    />
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [sp, prefs, locale] = await Promise.all([
    searchParams,
    getUserPreferences(),
    getLocale(),
  ]);
  const searchLocale = locale === "en" ? "en" : "no";
  // The visitor's campus only enables the "only my campus" switch and scopes
  // ranking; an unknown `?campus=` falls back to the cookie rather than 404ing.
  const campusId = resolveRequestCampus(sp.campus, prefs?.campusId) ?? null;
  return (
    <Suspense fallback={<FeedSkeleton />}>
      <SearchResults
        campusId={campusId}
        locale={searchLocale}
        params={parseSearchPageParams(sp)}
      />
    </Suspense>
  );
}
