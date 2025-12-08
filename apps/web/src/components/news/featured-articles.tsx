"use client";

import type { ContentTranslations } from "@repo/api/types/appwrite";
import { motion } from "motion/react";
import { ArticleCard } from "./article-card";

type FeaturedArticlesProps = {
 articles: ContentTranslations[];
};

export function FeaturedArticles({ articles }: FeaturedArticlesProps) {
 if (!articles || articles.length === 0) {
 return null;
 }

 return (
 <div className="mb-16">
 <motion.div
 className="mb-12 text-center"
 initial={{ opacity: 0, y: 20 }}
 viewport={{ once: true }}
 whileInView={{ opacity: 1, y: 0 }}
 >
 <div className="mb-4 inline-block rounded-full bg-brand-muted px-4 py-2 font-medium text-brand-dark text-sm">
 Featured Stories
 </div>
 <h2 className="font-bold text-3xl text-foreground md:text-4xl">
 Top News from the
 <br />
 <span className="bg-linear-to-r from-brand-gradient-from to-brand-gradient-to bg-clip-text text-transparent">
 BISO Community
 </span>
 </h2>
 </motion.div>

 <div className="space-y-8">
 {articles.map((article, index) => (
 <ArticleCard
 article={article}
 index={index}
 key={article.news_ref?.$id || article.$id}
 variant="featured"
 />
 ))}
 </div>
 </div>
 );
}
