"use client";
import type { ContentTranslations, News } from "@repo/api/types/appwrite";
import { ImageWithFallback } from "@repo/ui/components/image";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { PLACEHOLDER_IMAGE } from "@repo/ui/lib/placeholder-images";
import { ArrowRight, Clock } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useTranslations } from "next-intl";

interface NewsClientProps {
  news: News[];
}

export function NewsSection({ news }: NewsClientProps) {
  const t = useTranslations("home.news");
  if (!news || news.length === 0) {
    return (
      <section className="py-24" id="news">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="mb-6 font-bold text-3xl text-foreground md:text-4xl">
              {t("empty")}
            </h2>
            <p className="text-muted-foreground">{t("emptyDescription")}</p>
          </div>
        </div>
      </section>
    );
  }

  const featuredNews = news[0];
  const otherNews = news.slice(1);

  // Helper to format relative time
  const getRelativeTime = (dateString: string) => {
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

  const getTranslation = (item: News) =>
    Array.isArray(item.translation_refs)
      ? item.translation_refs.find(
          (entry): entry is ContentTranslations =>
            typeof entry === "object" && entry !== null && "title" in entry
        )
      : null;

  return (
    <section className="py-24" id="news">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          className="mb-16 text-center"
          initial={{ opacity: 0, y: 20 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <div className="mb-6 inline-block rounded-full bg-brand-muted px-4 py-2 text-brand-dark">
            {t("cta")}
          </div>
          <h2 className="mb-6 font-bold text-3xl text-foreground md:text-4xl">
            {t("stayUpdated")}
            <br />
            <span className="bg-linear-to-r from-brand-gradient-from to-brand-gradient-to bg-clip-text text-transparent">
              {t("titleDefault")}
            </span>
          </h2>
        </motion.div>

        {/* Featured News */}
        {featuredNews &&
          (() => {
            const translation = getTranslation(featuredNews);

            return (
              <motion.div
                className="mb-8"
                initial={{ opacity: 0, y: 20 }}
                viewport={{ once: true }}
                whileInView={{ opacity: 1, y: 0 }}
              >
                <Card className="overflow-hidden border-0 shadow-2xl transition-shadow duration-300 hover:shadow-3xl">
                  <div className="grid gap-0 md:grid-cols-2">
                    <div className="group relative h-96 overflow-hidden md:h-auto">
                      <ImageWithFallback
                        alt={translation?.title ?? "News"}
                        className="object-cover transition-transform duration-500 group-hover:scale-110"
                        fill
                        src={featuredNews.image || PLACEHOLDER_IMAGE}
                      />
                      <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent" />
                    </div>
                    <div className="flex flex-col justify-center p-12">
                      <div className="mb-4 flex items-center gap-2 text-brand">
                        <Clock className="h-4 w-4" />
                        <span>{getRelativeTime(featuredNews.$createdAt)}</span>
                      </div>
                      <h3 className="mb-4 text-foreground">
                        {translation?.title ?? "Untitled"}
                      </h3>
                      <p className="mb-6 text-muted-foreground">
                        {translation?.description
                          ?.replace(/<[^>]+>/g, "")
                          .slice(0, 200)}
                        ...
                      </p>
                      <Link href={`/news/${featuredNews.$id}`}>
                        <Button className="group w-fit border-0 bg-linear-to-r from-brand-gradient-from to-brand-gradient-to text-white hover:from-brand-gradient-from/90 hover:to-brand-gradient-to/90">
                          {t("readMore")}
                          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })()}

        {/* Other News */}
        {otherNews.length > 0 && (
          <div className="mb-12 grid gap-8 md:grid-cols-2">
            {otherNews.map((item, index) => {
              const translation = getTranslation(item);

              return (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  key={item.$id}
                  transition={{ delay: index * 0.1 }}
                  viewport={{ once: true }}
                  whileInView={{ opacity: 1, y: 0 }}
                >
                  <Card className="group h-full overflow-hidden border-0 shadow-lg transition-all duration-300 hover:shadow-xl">
                    <div className="relative h-56 overflow-hidden">
                      <ImageWithFallback
                        alt={translation?.title ?? "News"}
                        className="object-cover transition-transform duration-500 group-hover:scale-110"
                        fill
                        src={item.image || PLACEHOLDER_IMAGE}
                      />
                      <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent" />
                    </div>
                    <div className="p-6">
                      <div className="mb-3 flex items-center gap-2 text-brand">
                        <Clock className="h-4 w-4" />
                        <span className="text-sm">
                          {getRelativeTime(item.$createdAt)}
                        </span>
                      </div>
                      <h4 className="mb-3 text-foreground">
                        {translation?.title ?? "Untitled"}
                      </h4>
                      <p className="mb-4 text-muted-foreground">
                        {translation?.description
                          ?.replace(/<[^>]+>/g, "")
                          .slice(0, 150)}
                        ...
                      </p>
                      <Link href={`/news/${item.$id}`}>
                        <Button
                          className="group h-auto p-0 text-brand-dark hover:text-brand"
                          variant="ghost"
                        >
                          {t("readMore")}
                          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </Button>
                      </Link>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* View All Button */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1 }}
        >
          <Link href="/news">
            <Button
              className="border-primary text-primary hover:bg-accent"
              size="lg"
              variant="outline"
            >
              {t("viewAllNews")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
