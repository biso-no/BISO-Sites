import type { ContentTranslations, News } from "@repo/api/types/appwrite";
import type { Locale } from "@repo/i18n/config";
import { ImageWithFallback } from "@repo/ui/components/image";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { ChevronRight, Newspaper } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";

interface LatestNewsProps {
  locale: Locale;
  news: News[];
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
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-foreground">
          {locale === "en" ? "Latest News" : "Siste nytt"}
        </h2>
        <Button className="text-brand" size="sm" variant="ghost">
          <Link className="flex items-center" href="/news">
            {locale === "en" ? "View All" : "Se alle"}
            <ChevronRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="space-y-4">
        {news.slice(0, 2).map((article, index) => {
          const translation = Array.isArray(article.translation_refs)
            ? article.translation_refs.find(
                (item): item is ContentTranslations =>
                  typeof item === "object" && item !== null && "title" in item
              )
            : null;

          return (
            <motion.div
              animate={{ opacity: 1, x: 0 }}
              initial={{ opacity: 0, x: -20 }}
              key={article.$id}
              transition={{ delay: index * 0.1 }}
            >
              <Link href={`/news/${article.$id}`}>
                <Card className="group cursor-pointer border-0 p-4 shadow-md transition-all hover:shadow-lg">
                  <div className="flex gap-4">
                    <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg">
                      <ImageWithFallback
                        alt={translation?.title ?? "News"}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                        fill
                        src={
                          article.image ||
                          "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=400"
                        }
                      />
                    </div>
                    <div className="grow">
                      {article.$createdAt && (
                        <div className="mb-2 flex items-center gap-2 text-muted-foreground text-xs">
                          <Newspaper className="h-3 w-3 text-brand" />
                          {formatDate(article.$createdAt)}
                        </div>
                      )}
                      <h4 className="mb-2 text-foreground transition-colors group-hover:text-brand">
                        {translation?.title ?? "Untitled"}
                      </h4>
                      {translation?.short_description && (
                        <p className="line-clamp-2 text-muted-foreground text-sm">
                          {translation.short_description}
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
