import { ContentTranslations } from '@repo/api/types/appwrite';
import { ArticleCard } from './article-card';

interface RegularArticlesProps {
  articles: ContentTranslations[];
  showHeader: boolean;
}

export function RegularArticles({ articles, showHeader }: RegularArticlesProps) {
  return (
    <div>
      {showHeader && (
        <div className="flex items-center gap-3 mb-8">
          <div className="w-1 h-8 bg-linear-to-b from-[#3DA9E0] to-[#001731] rounded-full" />
          <h2 className="text-3xl font-bold text-gray-900">More News</h2>
        </div>
      )}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {articles.map((article) => (
          <ArticleCard key={article.news_ref?.$id} article={article} variant="regular" />
        ))}
      </div>
    </div>
  );
}