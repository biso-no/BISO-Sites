import type { Metadata } from "next";
import { Suspense } from "react";
import { listNews } from "@/app/actions/news";
import { NewsFilters } from "@/components/news/news-filters";
import { NewsGrid } from "@/components/news/news-grid";
import { NewsGridSkeleton } from "@/components/news/news-grid-skeleton";
import { NewsHero } from "@/components/news/news-hero";
import { NewsInfoSection } from "@/components/news/news-info-section";

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

  // Fetch data on the server
  const articles = await listNews();

  // Get unique categories and add "All" option
  const uniqueCategories = Array.from(
    new Set(articles.map((article) => article.content_type))
  );
  const categories = ["All", ...uniqueCategories];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <NewsHero />

      {/* Filters - Client component for interactivity */}
      <Suspense
        fallback={
          <div className="h-32 border-gray-100 border-b bg-white/95 shadow-lg backdrop-blur-lg" />
        }
      >
        <NewsFilters
          categories={categories}
          searchQuery={searchQuery}
          selectedCategory={selectedCategory}
        />
      </Suspense>

      {/* News Grid */}
      <div className="bg-linear-to-b from-gray-50 to-white py-16">
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
