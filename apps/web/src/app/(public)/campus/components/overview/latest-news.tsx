import type { ContentTranslations } from "@repo/api/types/appwrite";
import { ImageWithFallback } from "@repo/ui/components/image";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { ChevronRight, Newspaper } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import type { Locale } from "@/i18n/config";

interface LatestNewsProps {
  news: ContentTranslations[];
  locale: Locale;
}

export function LatestNews({ news, locale }: LatestNewsProps) {
  if (!news || news.length === 0) {
    return null;
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(locale === "en" ? "en-US" : "nb-NO", {
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-gray-900">
          {locale === "en" ? "Latest News" : "Siste nytt"}
        </h2>
        <Button variant="ghost" size="sm" className="text-[#3DA9E0]">
          <Link href="/news" className="flex items-center">
            {locale === "en" ? "View All" : "Se alle"}
            <ChevronRight className="w-4 h-4 ml-1" />
          </Link>
        </Button>
      </div>

      <div className="space-y-4">
        {news.slice(0, 2).map((article, index) => (
          <motion.div
            key={article.$id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Link href={`/news/${article.content_id}`}>
              <Card className="p-4 border-0 shadow-md hover:shadow-lg transition-all cursor-pointer group">
                <div className="flex gap-4">
                  <div className="w-24 h-24 shrink-0 rounded-lg overflow-hidden">
                    <ImageWithFallback
                      src={
                        article.news_ref?.image ||
                        "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=400"
                      }
                      alt={article.title}
                      fill
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  </div>
                  <div className="grow">
                    {article.$createdAt && (
                      <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                        <Newspaper className="w-3 h-3 text-[#3DA9E0]" />
                        {formatDate(article.$createdAt)}
                      </div>
                    )}
                    <h4 className="text-gray-900 mb-2 group-hover:text-[#3DA9E0] transition-colors">
                      {article.title}
                    </h4>
                    {article.short_description && (
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {article.short_description}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
