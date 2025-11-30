import type { ContentTranslations } from "@repo/api/types/appwrite";

export function filterArticles(
  articles: ContentTranslations[],
  category: string,
  searchQuery: string
) {
  return articles.filter(
    (article) =>
      article.content_type === category &&
      article.title.toLowerCase().includes(searchQuery.toLowerCase())
  );
}
