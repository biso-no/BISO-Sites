"use client";

import type { ContentTranslations, Jobs } from "@repo/api/types/appwrite";
import { Briefcase, Pencil, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteJob } from "../../_actions/jobs";
import { EmptyState } from "../../_components/empty-state";
import { PaginationBar } from "../../_components/pagination-bar";
import { SearchToolbar } from "../../_components/search-toolbar";
import { StatusBadge } from "../../_components/status-badge";

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

export function JobsListClient({
  initialJobs,
  total,
  page,
  labels,
}: JobsListClientProps) {
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
    const noTranslation = job.translation_refs.find((t) => t.locale === "no");
    const title = noTranslation?.title ?? "";
    const matchesSearch =
      !search || title.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = activeFilter === "all" || job.status === activeFilter;
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
    if (!confirm(labels.deleteConfirm)) {
      return;
    }
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
        description={labels.emptyDescription}
        icon={<Briefcase size={28} />}
        title={labels.empty}
      >
        <Link
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-medium text-sm"
          href="/admin/jobs/new"
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
        activeFilter={activeFilter}
        filters={filters}
        onFilterChange={setActiveFilter}
        onSearch={setSearch}
        placeholder={labels.searchPlaceholder}
      />

      {filtered.length === 0 ? (
        <EmptyState
          description="Try adjusting your search or filters."
          icon={<Briefcase size={28} />}
          title="No matching jobs"
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((job) => (
            <div
              className="group flex items-center gap-4 rounded-2xl px-5 py-4 transition-all"
              key={job.$id}
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              {/* Logo placeholder */}
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{
                  background: "rgba(61,169,224,0.10)",
                  border: "1px solid rgba(61,169,224,0.20)",
                }}
              >
                <Briefcase size={16} style={{ color: "#3DA9E0" }} />
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link
                    className="truncate font-medium text-sm transition-colors hover:text-[#3DA9E0]"
                    href={`/admin/jobs/${job.$id}`}
                    style={{ color: "#fff" }}
                  >
                    {getTitle(job)}
                  </Link>
                  <StatusBadge status={job.status} />
                </div>
                <div
                  className="mt-1 flex items-center gap-3 text-xs"
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
              <div className="relative flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                <Link
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-all"
                  href={`/admin/jobs/${job.$id}/applications`}
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    color: "rgba(255,255,255,0.50)",
                  }}
                >
                  <Users size={13} />
                  {labels.applications}
                </Link>
                <Link
                  aria-label={labels.edit}
                  className="flex h-8 w-8 items-center justify-center rounded-lg transition-all"
                  href={`/admin/jobs/${job.$id}`}
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    color: "rgba(255,255,255,0.50)",
                  }}
                >
                  <Pencil size={13} />
                </Link>
                <button
                  aria-label={labels.delete}
                  className="flex h-8 w-8 items-center justify-center rounded-lg transition-all"
                  onClick={() => handleDelete(job.$id)}
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
