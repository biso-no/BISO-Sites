"use client";

import type { ContentTranslations } from "@repo/api/types/appwrite";
import { motion } from "motion/react";
import { ArticleCard } from "./article-card";

type RegularArticlesProps = {
  articles: ContentTranslations[];
  showHeader: boolean;
};

export function RegularArticles({
  articles,
  showHeader,
}: RegularArticlesProps) {
  if (!articles || articles.length === 0) {
    return null;
  }

  return (
    <div>
      {showHeader && (
        <motion.div
          className="mb-12 text-center"
          initial={{ opacity: 0, y: 20 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <div className="mb-4 inline-block rounded-full bg-gray-100 px-4 py-2 font-medium text-gray-900 text-sm">
            More News
          </div>
          <h2 className="font-bold text-3xl text-gray-900 md:text-4xl">
            Latest Updates
          </h2>
        </motion.div>
      )}
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {articles.map((article, index) => (
          <ArticleCard
            article={article}
            index={index}
            key={article.news_ref?.$id || article.$id}
            variant="regular"
          />
        ))}
      </div>
    </div>
  );
}
