"use client";

import type { ContentTranslations } from "@repo/api/types/appwrite";
import { ImageWithFallback } from "@repo/ui/components/image";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Calendar, ExternalLink, Newspaper } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";

type NewsTabProps = {
  news: ContentTranslations[];
};

export function NewsTab({ news }: NewsTabProps) {
  return (
    <div className="space-y-8">
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="mb-12 text-center"
        initial={{ opacity: 0, y: 20 }}
      >
        <h2 className="mb-4 font-bold text-3xl text-foreground">
          News & Updates
        </h2>
        <p className="mx-auto max-w-2xl text-muted-foreground">
          Stay up to date with everything happening in this department
        </p>
      </motion.div>

      {news.length > 0 ? (
        <div className="space-y-6">
          {news.map((newsItem, index) => (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              initial={{ opacity: 0, y: 20 }}
              key={newsItem.$id}
              transition={{ delay: index * 0.1 }}
            >
              <Link
                href={`/news/${newsItem.news_ref?.$id || newsItem.content_id}`}
              >
                <Card className="group cursor-pointer overflow-hidden border-0 shadow-lg transition-all hover:shadow-xl">
                  <div className="md:flex">
                    <div className="relative h-64 overflow-hidden md:h-auto md:w-1/3">
                      {newsItem.news_ref?.image && (
                        <ImageWithFallback
                          alt={newsItem.title || "News"}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                          fill
                          src={newsItem.news_ref.image}
                        />
                      )}
                      <Badge className="absolute top-4 right-4 border-0 bg-[#3DA9E0] text-white">
                        News
                      </Badge>
                    </div>
                    <div className="p-8 md:w-2/3">
                      <div className="mb-4 flex items-center gap-2 text-muted-foreground text-sm">
                        <Calendar className="h-4 w-4 text-[#3DA9E0]" />
                        {new Date(
                          newsItem.news_ref?.$createdAt || newsItem.$createdAt
                        ).toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </div>
                      <h3 className="mb-4 font-bold text-2xl text-foreground transition-colors group-hover:text-[#3DA9E0]">
                        {newsItem.title || "Untitled"}
                      </h3>
                      <p className="mb-6 line-clamp-3 text-muted-foreground">
                        {newsItem.description ||
                          newsItem.short_description ||
                          ""}
                      </p>
                      <Button
                        className="border-[#3DA9E0]/20 text-[#3DA9E0] hover:bg-[#3DA9E0]/10"
                        variant="outline"
                      >
                        Read More
                        <ExternalLink className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      ) : (
        <Card className="border-0 p-12 text-center shadow-lg">
          <Newspaper className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
          <h3 className="mb-2 font-semibold text-foreground text-xl">
            No News Available
          </h3>
          <p className="text-muted-foreground">
            Check back soon for news and updates!
          </p>
        </Card>
      )}
    </div>
  );
}
