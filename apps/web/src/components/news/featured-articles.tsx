"use client";

import type { ContentTranslations } from "@repo/api/types/appwrite";
import { motion } from "motion/react";
import { ArticleCard } from "./article-card";

interface FeaturedArticlesProps {
  articles: ContentTranslations[];
}

export function FeaturedArticles({ articles }: FeaturedArticlesProps) {
  if (!articles || articles.length === 0) return null;

  return (
    <div className="mb-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-12"
      >
        <div className="inline-block px-4 py-2 rounded-full bg-[#3DA9E0]/10 text-[#001731] mb-4 text-sm font-medium">
          Featured Stories
        </div>
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
          Top News from the
          <br />
          <span className="bg-linear-to-r from-[#3DA9E0] to-[#001731] bg-clip-text text-transparent">
            BISO Community
          </span>
        </h2>
      </motion.div>

      <div className="space-y-8">
        {articles.map((article, index) => (
          <ArticleCard
            key={article.news_ref?.$id || article.$id}
            article={article}
            variant="featured"
            index={index}
          />
        ))}
      </div>
    </div>
  );
}
