'use client'

import { motion } from 'motion/react';
import { ContentTranslations } from '@repo/api/types/appwrite';
import { ArticleCard } from './article-card';

interface RegularArticlesProps {
  articles: ContentTranslations[];
  showHeader: boolean;
}

export function RegularArticles({ articles, showHeader }: RegularArticlesProps) {
  if (!articles || articles.length === 0) return null;

  return (
    <div>
      {showHeader && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <div className="inline-block px-4 py-2 rounded-full bg-gray-100 text-gray-900 mb-4 text-sm font-medium">
            More News
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Latest Updates</h2>
        </motion.div>
      )}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {articles.map((article, index) => (
          <ArticleCard 
            key={article.news_ref?.$id || article.$id} 
            article={article} 
            variant="regular"
            index={index}
          />
        ))}
      </div>
    </div>
  );
}