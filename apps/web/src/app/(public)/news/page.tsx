import type { Metadata } from "next";
import { Suspense } from "react";
import { listNews } from "@/app/actions/news";
import { NewsFilters } from "@/components/news/news-filters";
import { NewsGrid } from "@/components/news/news-grid";
import { NewsGridSkeleton } from "@/components/news/news-grid-skeleton";
import { NewsHero } from "@/components/news/news-hero";
import { NewsInfoSection } from "@/components/news/news-info-section";
import { getUserPreferences } from "@/lib/auth-utils";
import { Locale } from "@repo/api/types/appwrite";

export const metadata: Metadata = {
  title: "Latest News & Student Stories | BISO",
  description:
    "Stay updated with the latest happenings, achievements, and stories from the BISO community.",
  openGraph: {
    title: "Latest News & Student Stories | BISO",
    description:
      "Stay updated with the latest happenings, achievements, and stories from the BISO community.",
    images: ["/news-hero.jpg"],
  },
};

type NewsPageProps = {
  searchParams: Promise<{
    category?: string;
    search?: string;
  }>;
};

export default async function NewsPage({ searchParams }: NewsPageProps) {
  const { category, search } = await searchParams;
  const selectedCategory = category || "All";
  const searchQuery = search || "";

  const prefs = await getUserPreferences();

  // Fetch data on the server
  const articles = await listNews({
    campus: prefs?.campusId ?? "all",
    locale: prefs?.locale ?? Locale.EN,
    status: "published",
    limit: 100,
  });

  // Get unique categories and add "All" option
  const uniqueCategories = Array.from(
    new Set(articles.map((article) => article.content_type))
  );
  const categories = ["All", ...uniqueCategories];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <NewsHero />

      {/* Filters - Client component for interactivity */}
      <Suspense
        fallback={
          <div className="h-32 border-border border-b bg-background/95 shadow-lg backdrop-blur-lg" />
        }
      >
        <NewsFilters
          categories={categories}
          searchQuery={searchQuery}
          selectedCategory={selectedCategory}
        />
      </Suspense>

      {/* News Grid */}
      <div className="bg-linear-to-b from-section to-background py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Suspense fallback={<NewsGridSkeleton />}>
            <NewsGrid
              searchQuery={searchQuery}
              selectedCategory={selectedCategory}
            />
          </Suspense>
        </div>
      </div>

      {/* Info Section */}
      <NewsInfoSection />
    </div>
  );
}
