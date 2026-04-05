"use client";

import type { ContentTranslations, News } from "@repo/api/types/appwrite";
import { Newspaper, Pencil, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteNews } from "../../_actions/news";
import { EmptyState } from "../../_components/empty-state";
import { PaginationBar } from "../../_components/pagination-bar";
import { SearchToolbar } from "../../_components/search-toolbar";
import { StatusBadge } from "../../_components/status-badge";

type NewsWithTranslations = News & { translation_refs: ContentTranslations[] };

interface NewsListClientProps {
  initialArticles: NewsWithTranslations[];
  labels: {
    empty: string;
    emptyDescription: string;
    searchPlaceholder: string;
    all: string;
    published: string;
    draft: string;
    edit: string;
    delete: string;
    deleteConfirm: string;
  };
  page: number;
  total: number;
}

export function NewsListClient({
  initialArticles,
  total,
  page,
  labels,
}: NewsListClientProps) {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [, startTransition] = useTransition();

  const filters = [
    { label: labels.all, value: "all" },
    { label: labels.published, value: "published" },
    { label: labels.draft, value: "draft" },
  ];

  function getTitle(a: NewsWithTranslations) {
    return (
      a.translation_refs.find((t) => t.locale === "no")?.title ?? "Untitled"
    );
  }

  function getCategory(a: NewsWithTranslations) {
    const t = a.translation_refs.find((t) => t.locale === "no");
    if (t?.additional_fields) {
      try {
        return JSON.parse(t.additional_fields).category ?? null;
      } catch {
        return null;
      }
    }
    return null;
  }

  const filtered = initialArticles.filter((a) => {
    const title = getTitle(a);
    return (
      (!search || title.toLowerCase().includes(search.toLowerCase())) &&
      (activeFilter === "all" || a.status === activeFilter)
    );
  });

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteNews(id);
      if (result.error) {
        toast.error("Failed to delete article");
      } else {
        toast.success("Article deleted");
      }
    });
  }

  if (initialArticles.length === 0 && page === 1) {
    return (
      <EmptyState
        description={labels.emptyDescription}
        icon={<Newspaper size={28} />}
        title={labels.empty}
      >
        <Link
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-medium text-sm"
          href="/news/new"
          style={{ background: "#3DA9E0", color: "#001731" }}
        >
          Write first article
        </Link>
      </EmptyState>
    );
  }

  return (
    <>
      <SearchToolbar
        activeFilter={activeFilter}
        filters={filters}
        onFilterChange={setActiveFilter}
        onSearch={setSearch}
        placeholder={labels.searchPlaceholder}
      />
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Newspaper size={28} />}
          title="No matching articles"
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((article) => (
            <div
              className="group flex items-center gap-4 rounded-2xl px-5 py-4 transition-all"
              key={article.$id}
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              <div
                className="relative h-12 w-16 shrink-0 overflow-hidden rounded-xl"
                style={{ background: "rgba(255,255,255,0.05)" }}
              >
                {article.image ? (
                  <Image
                    alt=""
                    className="object-cover"
                    fill
                    src={article.image}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Newspaper
                      size={14}
                      style={{ color: "rgba(255,255,255,0.20)" }}
                    />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link
                    className="truncate font-medium text-sm transition-colors hover:text-[#3DA9E0]"
                    href={`/admin/news/${article.$id}`}
                    style={{ color: "#fff", fontFamily: "serif" }}
                  >
                    {getTitle(article)}
                  </Link>
                  <StatusBadge status={article.status} />
                </div>
                <div
                  className="mt-1 flex items-center gap-3 text-xs"
                  style={{ color: "rgba(255,255,255,0.35)" }}
                >
                  {article.author && <span>{article.author}</span>}
                  {getCategory(article) && (
                    <>
                      <span>·</span>
                      <span>{getCategory(article)}</span>
                    </>
                  )}
                  <span>·</span>
                  <span>
                    {new Date(article.$updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                <Link
                  className="flex h-8 w-8 items-center justify-center rounded-lg"
                  href={`/admin/news/${article.$id}`}
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    color: "rgba(255,255,255,0.50)",
                  }}
                >
                  <Pencil size={13} />
                </Link>
                <button
                  className="flex h-8 w-8 items-center justify-center rounded-lg"
                  onClick={() => handleDelete(article.$id)}
                  style={{
                    background: "rgba(248,113,113,0.08)",
                    color: "#f87171",
                  }}
                  type="button"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <PaginationBar page={page} total={total} />
    </>
  );
}
