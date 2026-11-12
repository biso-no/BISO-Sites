"use client";

import type { ContentTranslations, News } from "@repo/api/types/appwrite";
import { Newspaper } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { deleteNews } from "../../_actions/news";
import { NEWS_PAGE_SIZE } from "../../_actions/schemas";
import {
  ContentList,
  type ContentListLabels,
} from "../../_components/content-list";
import { StatusBadge } from "../../_components/status-badge";
import { SERIF_STACK, STUDIO } from "../../_components/studio";

type NewsWithTranslations = News & { translation_refs: ContentTranslations[] };

interface NewsListClientProps {
  initialArticles: NewsWithTranslations[];
  labels: ContentListLabels;
  page: number;
  total: number;
}

export function NewsListClient({
  initialArticles,
  total,
  page,
  labels,
}: NewsListClientProps) {
  const locale = useLocale() === "no" ? "no" : "en";
  const t = useTranslations("adminPortal.news");

  function getTitle(a: NewsWithTranslations) {
    return (
      a.translation_refs.find((translation) => translation.locale === locale)
        ?.title ??
      a.translation_refs[0]?.title ??
      t("fallback.untitled")
    );
  }

  function getCategory(a: NewsWithTranslations) {
    const translation = a.translation_refs.find(
      (item) => item.locale === locale
    );
    if (translation?.additional_fields) {
      try {
        return JSON.parse(translation.additional_fields).category ?? null;
      } catch {
        return null;
      }
    }
    return null;
  }

  async function removeArticle(id: string): Promise<boolean> {
    const result = await deleteNews(id);
    if (result.error) {
      toast.error(t("deleteError"));
      return false;
    }
    toast.success(t("deleteSuccess"));
    return true;
  }

  return (
    <ContentList
      basePath="/news"
      createLabel={t("create")}
      deleteItem={removeArticle}
      icon={Newspaper}
      items={initialArticles}
      labels={labels}
      matches={(article, search) =>
        getTitle(article).toLowerCase().includes(search.toLowerCase())
      }
      noMatchingTitle={t("noMatching")}
      page={page}
      pageSize={NEWS_PAGE_SIZE}
      renderBody={(article) => (
        <>
          <div className="flex items-center gap-2">
            <Link
              className="truncate font-medium text-sm transition-colors hover:text-[#3DA9E0]"
              href={`/news/${article.$id}`}
              style={{ color: STUDIO.ink, fontFamily: SERIF_STACK }}
            >
              {getTitle(article)}
            </Link>
            <StatusBadge status={article.status} />
          </div>
          <div
            className="mt-1 flex items-center gap-3 text-xs"
            style={{ color: STUDIO.ink4 }}
          >
            {article.author && <span>{article.author}</span>}
            {getCategory(article) && (
              <>
                <span>·</span>
                <span>{getCategory(article)}</span>
              </>
            )}
            <span>·</span>
            <span>{new Date(article.$updatedAt).toLocaleDateString()}</span>
          </div>
        </>
      )}
      renderLead={(article) => (
        <div
          className="relative h-12 w-16 shrink-0 overflow-hidden rounded-xl"
          style={{ background: STUDIO.paper2 }}
        >
          {article.image ? (
            <Image alt="" className="object-cover" fill src={article.image} />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Newspaper size={14} style={{ color: STUDIO.ink4 }} />
            </div>
          )}
        </div>
      )}
      total={total}
    />
  );
}
