"use client";

import type { Documents } from "@repo/api/types/appwrite";
import { Building2, FileText, Globe, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteDocument } from "../../_actions/documents";
import { DOCUMENTS_PAGE_SIZE } from "../../_actions/schemas";
import { EmptyState } from "../../_components/empty-state";
import { PaginationBar } from "../../_components/pagination-bar";
import { SearchToolbar } from "../../_components/search-toolbar";
import { StatusBadge } from "../../_components/status-badge";
import {
  STUDIO,
  StudioCrest,
  StudioLinkButton,
} from "../../_components/studio";

const CATEGORY_LABELS: Record<string, string> = {
  "national-statutes": "National Statutes",
  "campus-bylaws": "Campus Bylaws",
  "code-of-conduct": "Code of Conduct",
  "business-regulations": "Business Regulations",
  "communication-guidelines": "Communication Guidelines",
};

function formatBytes(bytes: number | null): string {
  if (!bytes) {
    return "—";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface DocumentsListClientProps {
  initialDocuments: Documents[];
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

export function DocumentsListClient({
  initialDocuments,
  labels,
  page,
  total,
}: DocumentsListClientProps) {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
    null
  );
  const [, startTransition] = useTransition();

  const filters = [
    { label: labels.all, value: "all" },
    { label: labels.published, value: "published" },
    { label: labels.draft, value: "draft" },
  ];

  const filtered = initialDocuments.filter((doc) => {
    const matchesSearch =
      !search ||
      doc.title.toLowerCase().includes(search.toLowerCase()) ||
      (doc.description ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesFilter = activeFilter === "all" || doc.status === activeFilter;
    return matchesSearch && matchesFilter;
  });

  function handleDelete(id: string) {
    if (confirmingDeleteId !== id) {
      setConfirmingDeleteId(id);
      toast.message(labels.deleteConfirm);
      return;
    }
    startTransition(async () => {
      const result = await deleteDocument(id);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Document deleted");
        setConfirmingDeleteId(null);
      }
    });
  }

  if (initialDocuments.length === 0 && page === 1) {
    return (
      <EmptyState
        description={labels.emptyDescription}
        icon={<FileText size={28} />}
        title={labels.empty}
      >
        <StudioLinkButton href="/documents/new" variant="primary">
          Upload first document
        </StudioLinkButton>
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
          icon={<FileText size={28} />}
          title="No matching documents"
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((doc) => {
            const isConfirmingDelete = confirmingDeleteId === doc.$id;
            return (
              <div
                className="group flex items-center gap-4 rounded-2xl border px-5 py-4 transition hover:bg-white/70"
                key={doc.$id}
                style={{
                  background: "rgba(255,255,255,0.46)",
                  borderColor: STUDIO.rule,
                }}
              >
                <StudioCrest icon={FileText} label={doc.title} />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      className="truncate font-medium text-sm transition-colors hover:text-[#3DA9E0]"
                      href={`/documents/${doc.$id}`}
                      style={{ color: STUDIO.ink }}
                    >
                      {doc.title}
                    </Link>
                    <StatusBadge status={doc.status} />
                    {doc.scope === "campus" && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
                        style={{
                          background: "rgba(42,74,122,0.08)",
                          color: STUDIO.sky,
                          border: "0.5px solid rgba(42,74,122,0.2)",
                        }}
                      >
                        <Building2 size={10} />
                        Campus
                      </span>
                    )}
                    {doc.scope === "national" && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
                        style={{
                          background: STUDIO.paper2,
                          color: STUDIO.ink3,
                          border: `0.5px solid ${STUDIO.rule2}`,
                        }}
                      >
                        <Globe size={10} />
                        National
                      </span>
                    )}
                  </div>
                  <div
                    className="mt-1 flex flex-wrap items-center gap-3 text-xs"
                    style={{ color: STUDIO.ink4 }}
                  >
                    <span>{CATEGORY_LABELS[doc.category] ?? doc.category}</span>
                    <span>·</span>
                    <span>v{doc.version_number}</span>
                    {doc.version && (
                      <>
                        <span>·</span>
                        <span>{doc.version}</span>
                      </>
                    )}
                    <span>·</span>
                    <span>{formatBytes(doc.file_size)}</span>
                    <span>·</span>
                    <span>{new Date(doc.$updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <Link
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    href={`/documents/${doc.$id}`}
                    style={{
                      background: STUDIO.paper2,
                      color: STUDIO.ink3,
                    }}
                    title={labels.edit}
                  >
                    <Pencil size={13} />
                  </Link>
                  <button
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    onClick={() => handleDelete(doc.$id)}
                    style={{
                      background: isConfirmingDelete
                        ? STUDIO.claret
                        : "rgba(107,30,30,0.08)",
                      color: isConfirmingDelete ? STUDIO.paper : STUDIO.claret,
                    }}
                    title={labels.delete}
                    type="button"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <PaginationBar page={page} size={DOCUMENTS_PAGE_SIZE} total={total} />
    </>
  );
}
