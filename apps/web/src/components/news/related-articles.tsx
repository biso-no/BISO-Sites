import type { News } from "@repo/api/types/appwrite";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArticleCard } from "./article-card";

interface RelatedArticlesProps {
  articles: News[];
}

export async function RelatedArticles({ articles }: RelatedArticlesProps) {
  if (articles.length === 0) {
    return null;
  }

  const t = await getTranslations("news.article");

  return (
    <section className="border-border border-t bg-section py-16 lg:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-semibold text-[0.7rem] text-brand uppercase tracking-[0.2em]">
              {t("relatedEyebrow")}
            </p>
            <h2 className="mt-2 font-bold text-3xl text-foreground tracking-tight">
              {t("relatedTitle")}
            </h2>
          </div>
          <Link
            className="group inline-flex items-center gap-2 font-medium text-brand-dark text-sm transition-colors hover:text-brand"
            href="/news"
          >
            {t("relatedAction")}
            <ArrowRight
              aria-hidden="true"
              className="h-4 w-4 transition-transform group-hover:translate-x-1"
            />
          </Link>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {articles.map((article, index) => (
            <ArticleCard
              article={article}
              index={index}
              key={article.$id}
              variant="regular"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
