"use client";

import type { ContentTranslations } from "@repo/api/types/appwrite";
import { ImageWithFallback } from "@repo/ui/components/image";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Calendar, ExternalLink, Newspaper } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";

interface NewsTabProps {
  news: ContentTranslations[];
}

export function NewsTab({ news }: NewsTabProps) {
  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <h2 className="text-3xl font-bold text-foreground mb-4">News & Updates</h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Stay up to date with everything happening in this department
        </p>
      </motion.div>

      {news.length > 0 ? (
        <div className="space-y-6">
          {news.map((newsItem, index) => (
            <motion.div
              key={newsItem.$id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Link href={`/news/${newsItem.news_ref?.$id || newsItem.content_id}`}>
                <Card className="overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all cursor-pointer group">
                  <div className="md:flex">
                    <div className="md:w-1/3 h-64 md:h-auto relative overflow-hidden">
                      {newsItem.news_ref?.image && (
                        <ImageWithFallback
                          src={newsItem.news_ref.image}
                          alt={newsItem.title || "News"}
                          fill
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                      )}
                      <Badge className="absolute top-4 right-4 bg-[#3DA9E0] text-white border-0">
                        News
                      </Badge>
                    </div>
                    <div className="md:w-2/3 p-8">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                        <Calendar className="w-4 h-4 text-[#3DA9E0]" />
                        {new Date(
                          newsItem.news_ref?.$createdAt || newsItem.$createdAt,
                        ).toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </div>
                      <h3 className="text-2xl font-bold text-foreground mb-4 group-hover:text-[#3DA9E0] transition-colors">
                        {newsItem.title || "Untitled"}
                      </h3>
                      <p className="text-muted-foreground mb-6 line-clamp-3">
                        {newsItem.description || newsItem.short_description || ""}
                      </p>
                      <Button
                        variant="outline"
                        className="border-[#3DA9E0]/20 text-[#3DA9E0] hover:bg-[#3DA9E0]/10"
                      >
                        Read More
                        <ExternalLink className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </div>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center border-0 shadow-lg">
          <Newspaper className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">No News Available</h3>
          <p className="text-muted-foreground">Check back soon for news and updates!</p>
        </Card>
      )}
    </div>
  );
}
