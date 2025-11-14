import { listNews, filterArticles } from '@/app/actions/news'
import { FeaturedArticles } from './featured-articles'
import { RegularArticles } from './regular-articles'
import { NoResults } from './no-results'
import { getLocale } from '@/app/actions/locale'
import { pickTranslation } from '@/lib/utils/content-translations'
import type { ContentTranslations, Locale } from '@repo/api/types/appwrite'

interface NewsGridProps {
  selectedCategory: string;
  searchQuery: string;
}

export async function NewsGrid({ selectedCategory, searchQuery }: NewsGridProps) {
  // Fetch and filter articles on the server
  const locale = await getLocale()
  const allArticles = await listNews()

  const normalizedArticles = allArticles
    .map((article) => {
      const translation = pickTranslation(article, locale as Locale)
      if (!translation) return null

      return {
        ...translation,
        $id: translation.$id ?? `${article.$id}-${translation.locale ?? locale}`,
        content_id: article.$id,
        news_ref: {
          ...article,
        },
      } as ContentTranslations
    })
    .filter((article): article is ContentTranslations => Boolean(article))

  const filteredArticles = await filterArticles(normalizedArticles, selectedCategory, searchQuery);

  const featuredArticles = filteredArticles.filter(article => article.news_ref?.sticky);
  const regularArticles = filteredArticles.filter(article => !article.news_ref?.sticky);

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