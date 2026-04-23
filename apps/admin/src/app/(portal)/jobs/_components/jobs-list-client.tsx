"use client";

import type { RecruitmentVacancy } from "@repo/shared/types/recruitment";
import { Briefcase, Pencil, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteJob } from "../../_actions/jobs";
import { EmptyState } from "../../_components/empty-state";
import { PaginationBar } from "../../_components/pagination-bar";
import { SearchToolbar } from "../../_components/search-toolbar";
import { StatusBadge } from "../../_components/status-badge";

interface JobsListClientProps {
  initialJobs: RecruitmentVacancy[];
  labels: {
    all: string;
    applications: string;
    closed: string;
    delete: string;
    deleteConfirm: string;
    draft: string;
    edit: string;
    empty: string;
    emptyDescription: string;
    published: string;
    searchPlaceholder: string;
  };
  page: number;
  total: number;
}

export function JobsListClient({
  initialJobs,
  labels,
  page,
  total,
}: JobsListClientProps) {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [, startTransition] = useTransition();

  const filters = [
    { label: labels.all, value: "all" },
    { label: labels.published, value: "published" },
    { label: labels.draft, value: "draft" },
    { label: labels.closed, value: "closed" },
  ];

  const filtered = initialJobs.filter((job) => {
    const title =
      job.translation_refs.find((translation) => translation.locale === "no")
        ?.title ?? "";

    return (
      (!search || title.toLowerCase().includes(search.toLowerCase())) &&
      (activeFilter === "all" || job.status === activeFilter)
    );
  });

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteJob(id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Vacancy deleted");
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
          href="/jobs/new"
          style={{ background: "#3DA9E0", color: "#001731" }}
        >
          Create first vacancy
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
          title="No matching vacancies"
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((job) => {
            const title =
              job.translation_refs.find(
                (translation) => translation.locale === "no"
              )?.title ?? "Untitled";

            return (
              <div
                className="group flex items-center gap-4 rounded-2xl px-5 py-4 transition-all"
                key={job.$id}
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{
                    background: "rgba(61,169,224,0.10)",
                    border: "1px solid rgba(61,169,224,0.20)",
                  }}
                >
                  <Briefcase size={16} style={{ color: "#3DA9E0" }} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      className="truncate font-medium text-sm transition-colors hover:text-[#3DA9E0]"
                      href={`/jobs/${job.$id}`}
                      style={{ color: "#fff" }}
                    >
                      {title}
                    </Link>
                    <StatusBadge status={job.status} />
                  </div>
                  <div
                    className="mt-1 flex items-center gap-3 text-xs"
                    style={{ color: "rgba(255,255,255,0.35)" }}
                  >
                    {job.metadata.company ? (
                      <span>{job.metadata.company}</span>
                    ) : null}
                    {job.metadata.employment_type ? (
                      <>
                        <span>·</span>
                        <span>{job.metadata.employment_type}</span>
                      </>
                    ) : null}
                    <span>·</span>
                    <span className="font-mono">{job.slug}</span>
                  </div>
                </div>

                <div className="relative flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <Link
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-all"
                    href={`/jobs/${job.$id}/applications`}
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
                    href={`/jobs/${job.$id}`}
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
            );
          })}
        </div>
      )}

      <PaginationBar page={page} total={total} />
    </>
  );
}
