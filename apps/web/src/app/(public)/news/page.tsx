import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getLocale } from "@/app/actions/locale";
import { listNews } from "@/app/actions/news";
import { NewsV2 } from "@/components/news/v2/news-v2";
import { FeedSkeleton } from "@/components/ui/loading-shell";
import { getUserPreferences } from "@/lib/auth-utils";
import { resolveRequestCampus } from "@/lib/campus-scope";
import { filterArticles } from "@/lib/utils";

export const metadata: Metadata = {
  // A campus-scoped feed is a filtered view of the same collection, so it
  // points its canonical at the unscoped URL rather than competing with it.
  alternates: { canonical: "/news" },
  title: "Latest News & Student Stories | BISO",
  description:
    "Stay updated with the latest happenings, achievements, and stories from the BISO community.",
  openGraph: {
    title: "Latest News & Student Stories | BISO",
    description:
      "Stay updated with the latest happenings, achievements, and stories from the BISO community.",
    images: ["/images/hero-bg.png"],
  },
};

interface NewsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function NewsListV2({
  campus,
  locale,
  searchParams,
  searchQuery,
}: {
  campus: string | null;
  locale: "en" | "no";
  searchParams: Record<string, string | string[] | undefined>;
  searchQuery: string;
}) {
  const articles = await listNews({
    campus: campus ?? "all",
    locale,
    status: "published",
    limit: 100,
  });

  return (
    <NewsV2
      articles={filterArticles(articles, "All", searchQuery)}
      campusId={campus}
      locale={locale}
      searchParams={searchParams}
      searchQuery={searchQuery}
    />
  );
}

export default async function NewsPage({ searchParams }: NewsPageProps) {
  const [sp, prefs, locale] = await Promise.all([
    searchParams,
    getUserPreferences(),
    getLocale(),
  ]);
  const searchQuery = typeof sp.search === "string" ? sp.search : "";

  // Locale comes from `getLocale()`, not from user preferences.
  // `getUserPreferences()` returns no locale when the visitor has never set
  // one, and the `?? "en"` fallback beneath it disagreed with `DEFAULT_LOCALE`,
  // which is `"no"` — so a first visit rendered Norwegian chrome over English
  // content. The chrome reads `getLocale()`; the data must read the same thing.
  // URL beats cookie beats "all"; an unrecognised campus 404s.
  const campus = resolveRequestCampus(sp.campus, prefs?.campusId);
  if (campus === undefined) {
    notFound();
  }

  return (
    <Suspense fallback={<FeedSkeleton />}>
      <NewsListV2
        campus={campus}
        locale={locale}
        searchParams={sp}
        searchQuery={searchQuery}
      />
    </Suspense>
  );
}
