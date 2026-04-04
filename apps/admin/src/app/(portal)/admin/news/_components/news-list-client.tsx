"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Newspaper, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteNews } from "../../_actions/news";
import { SearchToolbar } from "../../_components/search-toolbar";
import { StatusBadge } from "../../_components/status-badge";
import { EmptyState } from "../../_components/empty-state";
import type { News, ContentTranslations } from "@repo/api/types/appwrite";

type NewsWithTranslations = News & { translation_refs: ContentTranslations[] };

type NewsListClientProps = {
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
};

export function NewsListClient({ initialArticles, labels }: NewsListClientProps) {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [, startTransition] = useTransition();

  const filters = [
    { label: labels.all, value: "all" },
    { label: labels.published, value: "published" },
    { label: labels.draft, value: "draft" },
  ];

  function getTitle(a: NewsWithTranslations) {
    return a.translation_refs.find((t) => t.locale === "no")?.title ?? "Untitled";
  }

  function getCategory(a: NewsWithTranslations) {
    const t = a.translation_refs.find((t) => t.locale === "no");
    if (t?.additional_fields) {
      try { return JSON.parse(t.additional_fields).category ?? null; } catch { return null; }
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
    if (!confirm(labels.deleteConfirm)) return;
    startTransition(async () => {
      const result = await deleteNews(id);
      if (result.error) { toast.error("Failed to delete article"); } else { toast.success("Article deleted"); }
    });
  }

  if (initialArticles.length === 0) {
    return (
      <EmptyState icon={<Newspaper size={28} />} title={labels.empty} description={labels.emptyDescription}>
        <Link href="/admin/news/new" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium" style={{ background: "#3DA9E0", color: "#001731" }}>Write first article</Link>
      </EmptyState>
    );
  }

  return (
    <>
      <SearchToolbar placeholder={labels.searchPlaceholder} onSearch={setSearch} filters={filters} activeFilter={activeFilter} onFilterChange={setActiveFilter} />
      {filtered.length === 0 ? (
        <EmptyState icon={<Newspaper size={28} />} title="No matching articles" />
      ) : (
        <div className="space-y-3">
          {filtered.map((article) => (
            <div
              key={article.$id}
              className="group flex items-center gap-4 px-5 py-4 rounded-2xl transition-all"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
            >
              {/* Thumbnail */}
              <div className="w-16 h-12 rounded-xl overflow-hidden flex-shrink-0" style={{ background: "rgba(255,255,255,0.05)" }}>
                {article.image ? (
                  <img src={article.image} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Newspaper size={14} style={{ color: "rgba(255,255,255,0.20)" }} />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Link href={`/admin/news/${article.$id}`} className="text-sm font-medium hover:text-[#3DA9E0] transition-colors truncate" style={{ color: "#fff", fontFamily: "serif" }}>
                    {getTitle(article)}
                  </Link>
                  <StatusBadge status={article.status} />
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                  {article.author && <span>{article.author}</span>}
                  {getCategory(article) && <><span>·</span><span>{getCategory(article)}</span></>}
                  <span>·</span>
                  <span>{new Date(article.$updatedAt).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Link href={`/admin/news/${article.$id}`} className="flex items-center justify-center w-8 h-8 rounded-lg" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.50)" }}>
                  <Pencil size={13} />
                </Link>
                <button type="button" onClick={() => handleDelete(article.$id)} className="flex items-center justify-center w-8 h-8 rounded-lg" style={{ background: "rgba(248,113,113,0.08)", color: "#f87171" }}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
