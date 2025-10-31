"use client";

import { useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { useCampus } from "@/components/context/campus";
import { Card, CardContent, CardTitle } from "@repo/ui/components/ui/card";

import type { NewsItemWithTranslations } from "@/lib/types/news";

interface NewsContentProps {
  news: NewsItemWithTranslations[];
}

export function NewsContent({ news }: NewsContentProps) {
  const { activeCampusId } = useCampus();
  const t = useTranslations("home");

  const filteredNews = useMemo(() => {
    if (!activeCampusId) return news;
    return news.filter((item) => item.campus_id === activeCampusId);
  }, [news, activeCampusId]);

  const spotlightNews = useMemo(() => filteredNews.slice(0, 3), [filteredNews]);

  if (filteredNews.length === 0) {
    return (
      <div className="col-span-full rounded-2xl border border-dashed border-primary/20 bg-white/60 p-10 text-center text-muted-foreground">
        {t("news.empty")}
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {spotlightNews.map((item) => (
        <Card key={item.$id} className="overflow-hidden border border-primary/10 bg-white shadow-md transition hover:-translate-y-1 hover:shadow-card-hover">
          {item.image ? (
            <div className="relative h-48 w-full">
              <Image src={item.image} alt={item.title} fill className="object-cover" />
            </div>
          ) : null}
          <CardContent className="space-y-3 p-6">
            <div className="text-xs uppercase tracking-wide text-blue-accent/90">
              {new Date(item.$createdAt).toLocaleDateString()}
            </div>
            <CardTitle className="text-xl font-semibold text-primary-100">
              <Link href={`/news/${item.$id}`} className="hover:underline">
                {item.title}
              </Link>
            </CardTitle>
            <p className="line-clamp-3 text-sm text-muted-foreground">
              {item.content?.replace(/<[^>]+>/g, "").slice(0, 160)}
              {item.content && item.content.length > 160 ? "…" : ""}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
