"use client";

import type { ContentTranslations } from "@repo/api/types/appwrite";
import { ImageWithFallback } from "@repo/ui/components/image";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { ArrowRight, Clock } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";

type ArticleCardProps = {
  article: ContentTranslations;
  variant: "featured" | "regular";
  index?: number;
};

const categoryColors: Record<string, string> = {
  "Press Release": "bg-[#001731]/10 text-[#001731] border-[#001731]/20",
  "Student Life": "bg-[#3DA9E0]/10 text-[#001731] border-[#3DA9E0]/20",
  Achievements: "bg-cyan-100 text-[#001731] border-cyan-200",
  default: "bg-muted text-foreground border-border",
};

// Helper to format relative time
const getRelativeTime = (dateString?: string) => {
  if (!dateString) {
    return "Recently";
  }
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInDays === 0) {
    return "Today";
  }
  if (diffInDays === 1) {
    return "Yesterday";
  }
  if (diffInDays < 7) {
    return `${diffInDays} days ago`;
  }
  if (diffInDays < 30) {
    return `${Math.floor(diffInDays / 7)} weeks ago`;
  }
  if (diffInDays < 365) {
    return `${Math.floor(diffInDays / 30)} months ago`;
  }
  return date.toLocaleDateString();
};

export function ArticleCard({ article, variant, index = 0 }: ArticleCardProps) {
  const categoryColor =
    categoryColors[article.content_type] || categoryColors.default;
  const imageUrl =
    article.news_ref?.image ||
    "https://images.unsplash.com/photo-1745272749509-5d212d97cbd4?w=1080";
  const articleLink = `/news/${article.content_id}`;
  const relativeTime = getRelativeTime(
    article.news_ref?.$createdAt || article.$createdAt
  );

  // Clean description
  const cleanDescription = article.description?.replace(/<[^>]+>/g, "") || "";
  const shortDescription =
    cleanDescription.length > 150
      ? `${cleanDescription.slice(0, 150)}...`
      : cleanDescription;

  if (variant === "featured") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        transition={{ delay: index * 0.1 }}
        viewport={{ once: true }}
        whileInView={{ opacity: 1, y: 0 }}
      >
        <Link href={articleLink}>
          <Card className="group cursor-pointer overflow-hidden border-0 shadow-2xl transition-all duration-300 hover:shadow-3xl">
            <div className="grid gap-0 md:grid-cols-2">
              {/* Image */}
              <div className="relative h-96 overflow-hidden md:h-auto">
                <ImageWithFallback
                  alt={article.title}
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                  fill
                  src={imageUrl}
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent" />
                <Badge className={`absolute top-4 left-4 ${categoryColor}`}>
                  {article.content_type}
                </Badge>
              </div>

              {/* Content */}
              <div className="flex flex-col justify-center p-12">
                <div className="mb-4 flex items-center gap-2 text-[#3DA9E0]">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm">{relativeTime}</span>
                </div>
                <h3 className="mb-4 font-bold text-3xl text-foreground">
                  {article.title}
                </h3>
                <p className="mb-6 text-muted-foreground text-lg">{shortDescription}</p>
                <Button className="group w-fit border-0 bg-linear-to-r from-[#3DA9E0] to-[#001731] text-white hover:from-[#3DA9E0]/90 hover:to-[#001731]/90">
                  Read More
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
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
      transition={{ delay: index * 0.1 }}
      viewport={{ once: true }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      <Link href={articleLink}>
        <Card className="group flex h-full cursor-pointer flex-col overflow-hidden border-0 shadow-lg transition-all duration-300 hover:shadow-2xl">
          {/* Image */}
          <div className="relative h-56 overflow-hidden">
            <ImageWithFallback
              alt={article.title}
              className="object-cover transition-transform duration-500 group-hover:scale-110"
              fill
              src={imageUrl}
            />
            <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent" />
            <Badge className={`absolute top-4 left-4 ${categoryColor}`}>
              {article.content_type}
            </Badge>
          </div>

          {/* Content */}
          <div className="flex grow flex-col p-6">
            <div className="mb-3 flex items-center gap-2 text-[#3DA9E0]">
              <Clock className="h-4 w-4" />
              <span className="text-sm">{relativeTime}</span>
            </div>
            <h4 className="mb-3 line-clamp-2 font-bold text-foreground text-xl">
              {article.title}
            </h4>
            <p className="mb-4 line-clamp-3 grow text-muted-foreground">
              {shortDescription}
            </p>
            <Button
              className="group h-auto self-start p-0 text-[#001731] hover:text-[#3DA9E0]"
              variant="ghost"
            >
              Read More
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </div>
        </Card>
      </Link>
    </motion.div>
  );
}
