"use client";
import type { ContentTranslations } from "@repo/api/types/appwrite";
import { ImageWithFallback } from "@repo/ui/components/image";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { ArrowRight, Clock } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useTranslations } from "next-intl";

type NewsClientProps = {
 news: ContentTranslations[];
};

export function NewsClient({ news }: NewsClientProps) {
 const t = useTranslations("home.news");
 if (!news || news.length === 0) {
 return (
 <section className="bg-linear-to-b from-background to-section py-24" id="news">
 <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
 <div className="text-center">
 <h2 className="mb-6 text-foreground">{t("empty")}</h2>
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

 return (
 <section className="bg-linear-to-b from-background to-section py-24" id="news">
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
 <h2 className="mb-6 text-foreground">
 {t("stayUpdated")}
 <br />
 <span className="bg-linear-to-r from-brand-gradient-from to-brand-gradient-to bg-clip-text text-transparent">
 {t("titleDefault")}
 </span>
 </h2>
 </motion.div>

 {/* Featured News */}
 {featuredNews && (
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
 alt={featuredNews.title}
 className="object-cover transition-transform duration-500 group-hover:scale-110"
 fill
 src={
 featuredNews.news_ref?.image ||
 "https://images.unsplash.com/photo-1745272749509-5d212d97cbd4?w=1080"
 }
 />
 <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent" />
 </div>
 <div className="flex flex-col justify-center p-12">
 <div className="mb-4 flex items-center gap-2 text-brand">
 <Clock className="h-4 w-4" />
 <span>
 {getRelativeTime(
 featuredNews.news_ref?.$createdAt ||
 featuredNews.$createdAt
 )}
 </span>
 </div>
 <h3 className="mb-4 text-foreground">{featuredNews.title}</h3>
 <p className="mb-6 text-muted-foreground">
 {featuredNews.description
 ?.replace(/<[^>]+>/g, "")
 .slice(0, 200)}
 ...
 </p>
 <Link href={`/news/${featuredNews.content_id}`}>
 <Button className="group w-fit border-0 bg-linear-to-r from-brand-gradient-from to-brand-gradient-to text-white hover:from-brand-gradient-from/90 hover:to-brand-gradient-to/90">
 {t("readMore")}
 <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
 </Button>
 </Link>
 </div>
 </div>
 </Card>
 </motion.div>
 )}

 {/* Other News */}
 {otherNews.length > 0 && (
 <div className="mb-12 grid gap-8 md:grid-cols-2">
 {otherNews.map((item, index) => (
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
 alt={item.title}
 className="object-cover transition-transform duration-500 group-hover:scale-110"
 fill
 src={
 item.news_ref?.image ||
 "https://images.unsplash.com/photo-1758270705657-f28eec1a5694?w=1080"
 }
 />
 <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent" />
 </div>
 <div className="p-6">
 <div className="mb-3 flex items-center gap-2 text-brand">
 <Clock className="h-4 w-4" />
 <span className="text-sm">
 {getRelativeTime(
 item.news_ref?.$createdAt || item.$createdAt
 )}
 </span>
 </div>
 <h4 className="mb-3 text-foreground">{item.title}</h4>
 <p className="mb-4 text-muted-foreground">
 {item.description?.replace(/<[^>]+>/g, "").slice(0, 150)}
 ...
 </p>
 <Link href={`/news/${item.content_id}`}>
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
 ))}
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
