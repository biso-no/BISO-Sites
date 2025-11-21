"use client";

import { useSearchParams } from "next/navigation";
import React, { Suspense } from "react";
import { News, type NewsProps } from "../sections/news";

function FilteredNewsContent({ news = [], labels }: NewsProps) {
  const searchParams = useSearchParams();
  const query = searchParams.get("q")?.toLowerCase();

  const filteredNews = news.filter((item) => {
    const matchesSearch =
      !query ||
      item.title.toLowerCase().includes(query) ||
      item.description?.toLowerCase().includes(query) ||
      false;

    return matchesSearch;
  });

  return <News news={filteredNews} labels={labels} />;
}

export function FilteredNews(props: NewsProps) {
  return (
    <Suspense fallback={<News {...props} />}>
      <FilteredNewsContent {...props} />
    </Suspense>
  );
}
