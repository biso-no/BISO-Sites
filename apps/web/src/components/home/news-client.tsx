"use client";
import type { ContentTranslations } from "@repo/api/types/appwrite";
import { ImageWithFallback } from "@repo/ui/components/image";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { ArrowRight, Clock } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useTranslations } from "next-intl";

interface NewsClientProps {
  news: ContentTranslations[];
}

export function NewsClient({ news }: NewsClientProps) {
  const t = useTranslations("home.news");
  if (!news || news.length === 0) {
    return (
      <section id="news" className="py-24 bg-linear-to-b from-white to-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="mb-6 text-gray-900">{t("empty")}</h2>
            <p className="text-gray-600">{t("emptyDescription")}</p>
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

    if (diffInDays === 0) return "Today";
    if (diffInDays === 1) return "Yesterday";
    if (diffInDays < 7) return `${diffInDays} days ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
    if (diffInDays < 365) return `${Math.floor(diffInDays / 30)} months ago`;
    return date.toLocaleDateString();
  };

  return (
    <section id="news" className="py-24 bg-linear-to-b from-white to-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-block px-4 py-2 rounded-full bg-[#3DA9E0]/10 text-[#001731] mb-6">
            {t("cta")}
          </div>
          <h2 className="mb-6 text-gray-900">
            {t("stayUpdated")}
            <br />
            <span className="bg-linear-to-r from-[#3DA9E0] to-[#001731] bg-clip-text text-transparent">
              {t("titleDefault")}
            </span>
          </h2>
        </motion.div>

        {/* Featured News */}
        {featuredNews && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-8"
          >
            <Card className="overflow-hidden border-0 shadow-2xl hover:shadow-3xl transition-shadow duration-300">
              <div className="grid md:grid-cols-2 gap-0">
                <div className="relative h-96 md:h-auto overflow-hidden group">
                  <ImageWithFallback
                    src={
                      featuredNews.news_ref?.image ||
                      "https://images.unsplash.com/photo-1745272749509-5d212d97cbd4?w=1080"
                    }
                    alt={featuredNews.title}
                    fill
                    className="object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent" />
                </div>
                <div className="p-12 flex flex-col justify-center">
                  <div className="flex items-center gap-2 text-[#3DA9E0] mb-4">
                    <Clock className="w-4 h-4" />
                    <span>
                      {getRelativeTime(
                        featuredNews.news_ref?.$createdAt || featuredNews.$createdAt,
                      )}
                    </span>
                  </div>
                  <h3 className="mb-4 text-gray-900">{featuredNews.title}</h3>
                  <p className="text-gray-600 mb-6">
                    {featuredNews.description?.replace(/<[^>]+>/g, "").slice(0, 200)}...
                  </p>
                  <Link href={`/news/${featuredNews.content_id}`}>
                    <Button className="w-fit bg-linear-to-r from-[#3DA9E0] to-[#001731] hover:from-[#3DA9E0]/90 hover:to-[#001731]/90 text-white border-0 group">
                      {t("readMore")}
                      <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Other News */}
        {otherNews.length > 0 && (
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {otherNews.map((item, index) => (
              <motion.div
                key={item.$id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 group h-full">
                  <div className="relative h-56 overflow-hidden">
                    <ImageWithFallback
                      src={
                        item.news_ref?.image ||
                        "https://images.unsplash.com/photo-1758270705657-f28eec1a5694?w=1080"
                      }
                      alt={item.title}
                      fill
                      className="object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent" />
                  </div>
                  <div className="p-6">
                    <div className="flex items-center gap-2 text-[#3DA9E0] mb-3">
                      <Clock className="w-4 h-4" />
                      <span className="text-sm">
                        {getRelativeTime(item.news_ref?.$createdAt || item.$createdAt)}
                      </span>
                    </div>
                    <h4 className="mb-3 text-gray-900">{item.title}</h4>
                    <p className="text-gray-600 mb-4">
                      {item.description?.replace(/<[^>]+>/g, "").slice(0, 150)}...
                    </p>
                    <Link href={`/news/${item.content_id}`}>
                      <Button
                        variant="ghost"
                        className="text-[#001731] hover:text-[#3DA9E0] p-0 h-auto group"
                      >
                        {t("readMore")}
                        <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </Link>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {/* View All Button */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <Link href="/news">
            <Button
              variant="outline"
              size="lg"
              className="border-blue-600 text-blue-600 hover:bg-blue-50"
            >
              {t("viewAllNews")}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
