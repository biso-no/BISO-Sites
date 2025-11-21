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

interface NewsPageProps {
  searchParams: Promise<{
    category?: string;
    search?: string;
  }>;
}

export default async function NewsPage({ searchParams }: NewsPageProps) {
  const { category, search } = await searchParams;
  const selectedCategory = category || "All";
  const searchQuery = search || "";

  // Fetch data on the server
  const articles = await listNews();

  // Get unique categories and add "All" option
  const uniqueCategories = Array.from(new Set(articles.map((article) => article.content_type)));
  const categories = ["All", ...uniqueCategories];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <NewsHero />

      {/* Filters - Client component for interactivity */}
      <Suspense
        fallback={
          <div className="h-32 bg-white/95 backdrop-blur-lg shadow-lg border-b border-gray-100" />
        }
      >
        <NewsFilters
          categories={categories}
          selectedCategory={selectedCategory}
          searchQuery={searchQuery}
        />
      </Suspense>

      {/* News Grid */}
      <div className="bg-linear-to-b from-gray-50 to-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Suspense fallback={<NewsGridSkeleton />}>
            <NewsGrid selectedCategory={selectedCategory} searchQuery={searchQuery} />
          </Suspense>
        </div>
      </div>

      {/* Info Section */}
      <NewsInfoSection />
    </div>
  );
}
