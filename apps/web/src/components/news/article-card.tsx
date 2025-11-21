"use client";

import type { ContentTranslations } from "@repo/api/types/appwrite";
import { ImageWithFallback } from "@repo/ui/components/image";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { ArrowRight, Calendar, Clock } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";

interface ArticleCardProps {
  article: ContentTranslations;
  variant: "featured" | "regular";
  index?: number;
}

export const categoryColors: Record<string, string> = {
  "Press Release": "bg-[#001731]/10 text-[#001731] border-[#001731]/20",
  "Student Life": "bg-[#3DA9E0]/10 text-[#001731] border-[#3DA9E0]/20",
  Achievements: "bg-cyan-100 text-[#001731] border-cyan-200",
  default: "bg-gray-100 text-gray-900 border-gray-200",
};

// Helper to format relative time
const getRelativeTime = (dateString?: string) => {
  if (!dateString) return "Recently";
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInDays === 0) return "Today";
  if (diffInDays === 1) return "Yesterday";
  if (diffInDays < 7) return `${diffInDays} days ago`;
  if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
  if (diffInDays < 365) return `${Math.floor(diffInDays / 30)} months ago`;
  return date.toLocaleDateString();
};

export function ArticleCard({ article, variant, index = 0 }: ArticleCardProps) {
  const categoryColor = categoryColors[article.content_type] || categoryColors["default"];
  const imageUrl =
    article.news_ref?.image ||
    "https://images.unsplash.com/photo-1745272749509-5d212d97cbd4?w=1080";
  const articleLink = `/news/${article.content_id}`;
  const relativeTime = getRelativeTime(article.news_ref?.$createdAt || article.$createdAt);

  // Clean description
  const cleanDescription = article.description?.replace(/<[^>]+>/g, "") || "";
  const shortDescription =
    cleanDescription.length > 150 ? `${cleanDescription.slice(0, 150)}...` : cleanDescription;

  if (variant === "featured") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: index * 0.1 }}
      >
        <Link href={articleLink}>
          <Card className="overflow-hidden border-0 shadow-2xl hover:shadow-3xl transition-all duration-300 group cursor-pointer">
            <div className="grid md:grid-cols-2 gap-0">
              {/* Image */}
              <div className="relative h-96 md:h-auto overflow-hidden">
                <ImageWithFallback
                  src={imageUrl}
                  alt={article.title}
                  fill
                  className="object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent" />
                <Badge className={`absolute top-4 left-4 ${categoryColor}`}>
                  {article.content_type}
                </Badge>
              </div>

              {/* Content */}
              <div className="p-12 flex flex-col justify-center">
                <div className="flex items-center gap-2 text-[#3DA9E0] mb-4">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">{relativeTime}</span>
                </div>
                <h3 className="text-3xl font-bold mb-4 text-gray-900">{article.title}</h3>
                <p className="text-gray-600 mb-6 text-lg">{shortDescription}</p>
                <Button className="w-fit bg-linear-to-r from-[#3DA9E0] to-[#001731] hover:from-[#3DA9E0]/90 hover:to-[#001731]/90 text-white border-0 group">
                  Read More
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
            </div>
          </Card>
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1 }}
    >
      <Link href={articleLink}>
        <Card className="overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-300 group h-full flex flex-col cursor-pointer">
          {/* Image */}
          <div className="relative h-56 overflow-hidden">
            <ImageWithFallback
              src={imageUrl}
              alt={article.title}
              fill
              className="object-cover group-hover:scale-110 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent" />
            <Badge className={`absolute top-4 left-4 ${categoryColor}`}>
              {article.content_type}
            </Badge>
          </div>

          {/* Content */}
          <div className="p-6 flex flex-col grow">
            <div className="flex items-center gap-2 text-[#3DA9E0] mb-3">
              <Clock className="w-4 h-4" />
              <span className="text-sm">{relativeTime}</span>
            </div>
            <h4 className="text-xl font-bold mb-3 text-gray-900 line-clamp-2">{article.title}</h4>
            <p className="text-gray-600 mb-4 grow line-clamp-3">{shortDescription}</p>
            <Button
              variant="ghost"
              className="text-[#001731] hover:text-[#3DA9E0] p-0 h-auto group self-start"
            >
              Read More
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        </Card>
      </Link>
    </motion.div>
  );
}
