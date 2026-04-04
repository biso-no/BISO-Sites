import type { News } from "@repo/api/types/appwrite";
import { filterArticles } from "@/lib/utils";
import { FeaturedArticles } from "./featured-articles";
import { NoResults } from "./no-results";
import { RegularArticles } from "./regular-articles";

interface NewsGridProps {
  articles: News[];
  searchQuery: string;
  selectedCategory: string;
}

export async function NewsGrid({
  articles,
  selectedCategory,
  searchQuery,
}: NewsGridProps) {
  const filteredArticles = filterArticles(
    articles,
    selectedCategory,
    searchQuery
  );

  const featuredArticles = filteredArticles.filter((article) => article.sticky);
  const regularArticles = filteredArticles.filter((article) => !article.sticky);

  if (filteredArticles.length === 0) {
    return <NoResults />;
  }

  return (
    <div>
      {/* Featured Articles */}
      {featuredArticles.length > 0 && (
        <FeaturedArticles articles={featuredArticles} />
      )}

      {/* Regular Articles */}
      {regularArticles.length > 0 && (
        <RegularArticles
          articles={regularArticles}
          showHeader={featuredArticles.length > 0}
        />
      )}
    </div>
  );
}
