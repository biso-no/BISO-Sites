import { Suspense } from 'react';
import { Metadata } from 'next';
import { NewsHero } from '@/components/news/news-hero';
import { NewsFilters } from '@/components/news/news-filters';
import { NewsGrid } from '@/components/news/news-grid';
import { NewsGridSkeleton } from '@/components/news/news-grid-skeleton';
import { listNews } from '@/app/actions/news';

export const metadata: Metadata = {
  title: 'Latest News & Student Stories | BISO',
  description: 'Stay updated with the latest happenings, achievements, and stories from the BISO community.',
  openGraph: {
    title: 'Latest News & Student Stories | BISO',
    description: 'Stay updated with the latest happenings, achievements, and stories from the BISO community.',
    images: ['/news-hero.jpg'],
  },
};

interface NewsPageProps {
  searchParams: {
    category?: string;
    search?: string;
  };
}

export default async function NewsPage({ searchParams }: NewsPageProps) {
  const selectedCategory = searchParams.category || 'All';
  const searchQuery = searchParams.search || '';

  // Fetch data on the server
  const articles = await listNews();

  const categories = Array.from(new Set(articles.map(article => article.content_type)));
  const filteredArticles = articles.filter(article => article.content_type === selectedCategory);

  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white">
      {/* Hero Section - Static, renders immediately */}
      <NewsHero />

      {/* Filters - Client component for interactivity */}
      <Suspense fallback={<div className="h-32 bg-white/95 backdrop-blur-lg shadow-lg border-b border-gray-100" />}>
        <NewsFilters 
          categories={categories}
          selectedCategory={selectedCategory}
          searchQuery={searchQuery}
        />
      </Suspense>

      {/* News Grid - Suspense boundary for data fetching */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <Suspense fallback={<NewsGridSkeleton />}>
          <NewsGrid 
            selectedCategory={selectedCategory}
            searchQuery={searchQuery}
          />
        </Suspense>
      </div>
    </div>
  );
}