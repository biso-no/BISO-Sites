import { listNews } from "@/app/actions/news";
import { FeaturedArticles } from "./featured-articles";
import { NoResults } from "./no-results";
import { RegularArticles } from "./regular-articles";
import { filterArticles } from "@/lib/utils";

type NewsGridProps = {
  selectedCategory: string;
  searchQuery: string;
};

export async function NewsGrid({
  selectedCategory,
  searchQuery,
}: NewsGridProps) {
  // Fetch and filter articles on the server
  const allArticles = await listNews();
  const filteredArticles = await filterArticles(
    allArticles,
    selectedCategory,
    searchQuery
  );

  const featuredArticles = filteredArticles.filter(
    (article) => article.news_ref?.sticky
  );
  const regularArticles = filteredArticles.filter(
    (article) => !article.news_ref?.sticky
  );

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
