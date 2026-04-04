"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Briefcase,
  MoreHorizontal,
  Pencil,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { deleteJob } from "../../_actions/jobs";
import { SearchToolbar } from "../../_components/search-toolbar";
import { StatusBadge } from "../../_components/status-badge";
import { EmptyState } from "../../_components/empty-state";
import { PaginationBar } from "../../_components/pagination-bar";
import type { Jobs, ContentTranslations } from "@repo/api/types/appwrite";

type JobWithTranslations = Jobs & {
  translation_refs: ContentTranslations[];
};

type JobsListClientProps = {
  initialJobs: JobWithTranslations[];
  total: number;
  page: number;
  labels: {
    empty: string;
    emptyDescription: string;
    searchPlaceholder: string;
    all: string;
    published: string;
    draft: string;
    closed: string;
    applications: string;
    edit: string;
    delete: string;
    deleteConfirm: string;
  };
};

export function JobsListClient({ initialJobs, total, page, labels }: JobsListClientProps) {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const filters = [
    { label: labels.all, value: "all" },
    { label: labels.published, value: "published" },
    { label: labels.draft, value: "draft" },
    { label: labels.closed, value: "closed" },
  ];

  const filtered = initialJobs.filter((job) => {
    const noTranslation = job.translation_refs.find(
      (t) => t.locale === "no"
    );
    const title = noTranslation?.title ?? "";
    const matchesSearch =
      !search || title.toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      activeFilter === "all" || job.status === activeFilter;
    return matchesSearch && matchesFilter;
  });

  function getTitle(job: JobWithTranslations) {
    const t = job.translation_refs.find((t) => t.locale === "no");
    return t?.title ?? "Untitled";
  }

  function getCompany(job: JobWithTranslations) {
    const t = job.translation_refs.find((t) => t.locale === "no");
    if (t?.additional_fields) {
      try {
        const extra = JSON.parse(t.additional_fields);
        return extra.company ?? null;
      } catch {
        return null;
      }
    }
    return null;
  }

  function getEmploymentType(job: JobWithTranslations) {
    const t = job.translation_refs.find((t) => t.locale === "no");
    if (t?.additional_fields) {
      try {
        const extra = JSON.parse(t.additional_fields);
        return extra.employment_type ?? null;
      } catch {
        return null;
      }
    }
    return null;
  }

  function handleDelete(id: string) {
    if (!confirm(labels.deleteConfirm)) return;
    startTransition(async () => {
      const result = await deleteJob(id);
      if (result.error) {
        toast.error(
          typeof result.error === "string"
            ? result.error
            : "Failed to delete job"
        );
      } else {
        toast.success("Job deleted");
      }
    });
  }

  if (initialJobs.length === 0 && page === 1) {
    return (
      <EmptyState
        icon={<Briefcase size={28} />}
        title={labels.empty}
        description={labels.emptyDescription}
      >
        <Link
          href="/admin/jobs/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
          style={{ background: "#3DA9E0", color: "#001731" }}
        >
          Create first job
        </Link>
      </EmptyState>
    );
  }

  return (
    <>
      <SearchToolbar
        placeholder={labels.searchPlaceholder}
        onSearch={setSearch}
        filters={filters}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Briefcase size={28} />}
          title="No matching jobs"
          description="Try adjusting your search or filters."
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((job) => (
            <div
              key={job.$id}
              className="group flex items-center gap-4 px-5 py-4 rounded-2xl transition-all"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              {/* Logo placeholder */}
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: "rgba(61,169,224,0.10)",
                  border: "1px solid rgba(61,169,224,0.20)",
                }}
              >
                <Briefcase size={16} style={{ color: "#3DA9E0" }} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/admin/jobs/${job.$id}`}
                    className="text-sm font-medium hover:text-[#3DA9E0] transition-colors truncate"
                    style={{ color: "#fff" }}
                  >
                    {getTitle(job)}
                  </Link>
                  <StatusBadge status={job.status} />
                </div>
                <div
                  className="flex items-center gap-3 mt-1 text-xs"
                  style={{ color: "rgba(255,255,255,0.35)" }}
                >
                  {getCompany(job) && <span>{getCompany(job)}</span>}
                  {getEmploymentType(job) && (
                    <>
                      <span>·</span>
                      <span>{getEmploymentType(job)}</span>
                    </>
                  )}
                  <span>·</span>
                  <span className="font-mono">{job.slug}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="relative flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Link
                  href={`/admin/jobs/${job.$id}/applications`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    color: "rgba(255,255,255,0.50)",
                  }}
                >
                  <Users size={13} />
                  {labels.applications}
                </Link>
                <Link
                  href={`/admin/jobs/${job.$id}`}
                  className="flex items-center justify-center w-8 h-8 rounded-lg transition-all"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    color: "rgba(255,255,255,0.50)",
                  }}
                  aria-label={labels.edit}
                >
                  <Pencil size={13} />
                </Link>
                <button
                  type="button"
                  onClick={() => handleDelete(job.$id)}
                  className="flex items-center justify-center w-8 h-8 rounded-lg transition-all"
                  style={{
                    background: "rgba(248,113,113,0.08)",
                    color: "#f87171",
                  }}
                  aria-label={labels.delete}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <PaginationBar total={total} page={page} />
    </>
  );
}
