import type { ContentTranslations, News } from "@repo/api/types/appwrite";

export function filterArticles(
  articles: News[],
  category: string,
  searchQuery: string
) {
  const query = searchQuery.trim().toLowerCase();

  return articles.filter((article) => {
    const translation = Array.isArray(article.translation_refs)
      ? article.translation_refs.find(
          (item): item is ContentTranslations =>
            typeof item === "object" && item !== null && "title" in item
        )
      : null;

    const title = (translation?.title ?? "").toLowerCase();
    const description = (translation?.description ?? "").toLowerCase();

    const matchesSearch =
      !query || title.includes(query) || description.includes(query);

    const matchesCategory = category === "All";

    return matchesSearch && matchesCategory;
  });
}

export const isProd =
  process.env.NODE_ENV === "production" ||
  process.env.VERCEL_ENV === "production";
