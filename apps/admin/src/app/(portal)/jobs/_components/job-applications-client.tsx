"use client";

import { JobApplicationStatus } from "@repo/api/types/appwrite";
import {
  getAllowedRecruitmentApplicationTransitions,
  type RecruitmentApplicationRecord,
} from "@repo/shared/types/recruitment";
import {
  Briefcase,
  Download,
  FileText,
  Mail,
  Phone,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { updateJobApplicationStatus } from "../../_actions/jobs";
import { EmptyState } from "../../_components/empty-state";
import { PaginationBar } from "../../_components/pagination-bar";
import { SearchToolbar } from "../../_components/search-toolbar";
import { StatusBadge } from "../../_components/status-badge";

interface JobApplicationsClientProps {
  initialApplications: RecruitmentApplicationRecord[];
  page: number;
  title: string;
  total: number;
}

const STATUS_FILTERS = [
  { label: "All", value: "all" },
  { label: "Submitted", value: JobApplicationStatus.SUBMITTED },
  { label: "Reviewed", value: JobApplicationStatus.REVIEWED },
  { label: "Interview", value: JobApplicationStatus.INTERVIEW },
  { label: "Accepted", value: JobApplicationStatus.ACCEPTED },
  { label: "Rejected", value: JobApplicationStatus.REJECTED },
] as const;

const STATUS_ACTION_LABELS: Record<JobApplicationStatus, string> = {
  [JobApplicationStatus.SUBMITTED]: "Mark submitted",
  [JobApplicationStatus.REVIEWED]: "Mark reviewed",
  [JobApplicationStatus.INTERVIEW]: "Move to interview",
  [JobApplicationStatus.ACCEPTED]: "Accept candidate",
  [JobApplicationStatus.REJECTED]: "Reject candidate",
};

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

interface ApplicationDetailPanelProps {
  application: RecruitmentApplicationRecord | null;
  onStatusUpdate: (status: JobApplicationStatus) => void;
  title: string;
}

function ApplicationDetailPanel({
  application,
  onStatusUpdate,
  title,
}: ApplicationDetailPanelProps) {
  if (!application) {
    return (
      <EmptyState
        description="Select an application to review the candidate details."
        icon={<FileText size={28} />}
        title="Choose an application"
      />
    );
  }

  const availableTransitions = getAllowedRecruitmentApplicationTransitions(
    application.status
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2
              className="font-light text-2xl tracking-tight"
              style={{ color: "#fff" }}
            >
              {application.applicant_name}
            </h2>
            <StatusBadge size="md" status={application.status} />
          </div>
          <p
            className="mt-1 text-sm"
            style={{ color: "rgba(255,255,255,0.45)" }}
          >
            {application.job?.title ?? title}
          </p>
        </div>

        {application.job ? (
          <Link
            className="rounded-xl px-3 py-2 text-xs transition-all"
            href={`/jobs/${application.job.$id}`}
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.65)",
            }}
          >
            Open vacancy
          </Link>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div
          className="rounded-2xl p-4"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <p
            className="mb-3 text-xs uppercase tracking-[0.2em]"
            style={{ color: "rgba(255,255,255,0.30)" }}
          >
            Candidate
          </p>
          <div className="space-y-2 text-sm">
            <p className="flex items-center gap-2" style={{ color: "#fff" }}>
              <UserRound size={14} />
              {application.applicant_name}
            </p>
            <p style={{ color: "rgba(255,255,255,0.65)" }}>
              {application.applicant_email}
            </p>
            <p style={{ color: "rgba(255,255,255,0.65)" }}>
              {application.applicant_phone ?? "No phone provided"}
            </p>
          </div>
        </div>

        <div
          className="rounded-2xl p-4"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <p
            className="mb-3 text-xs uppercase tracking-[0.2em]"
            style={{ color: "rgba(255,255,255,0.30)" }}
          >
            Processing
          </p>
          <div className="space-y-2 text-sm">
            <p style={{ color: "rgba(255,255,255,0.65)" }}>
              Submitted {formatDateTime(application.$createdAt)}
            </p>
            <p style={{ color: "rgba(255,255,255,0.65)" }}>
              Consent recorded {formatDateTime(application.consent_date)}
            </p>
            <p style={{ color: "rgba(255,255,255,0.65)" }}>
              Retention until {formatDateTime(application.data_retention_until)}
            </p>
          </div>
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <p
            className="text-xs uppercase tracking-[0.2em]"
            style={{ color: "rgba(255,255,255,0.30)" }}
          >
            Application Materials
          </p>
          {application.resume_file_id ? (
            <a
              className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs transition-all"
              href={`/api/recruitment/applications/${application.$id}/resume`}
              style={{
                background: "rgba(61,169,224,0.10)",
                border: "1px solid rgba(61,169,224,0.25)",
                color: "#3DA9E0",
              }}
            >
              <Download size={13} />
              Download CV
            </a>
          ) : null}
        </div>

        <div
          className="rounded-2xl p-4"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <p className="mb-2 font-medium text-sm" style={{ color: "#fff" }}>
            Cover letter
          </p>
          <p
            className="whitespace-pre-wrap text-sm leading-6"
            style={{ color: "rgba(255,255,255,0.70)" }}
          >
            {application.cover_letter?.trim() || "No cover letter provided."}
          </p>
        </div>
      </div>

      <div>
        <p
          className="mb-3 text-xs uppercase tracking-[0.2em]"
          style={{ color: "rgba(255,255,255,0.30)" }}
        >
          Status Actions
        </p>
        {availableTransitions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {availableTransitions.map((status) => (
              <button
                className="rounded-xl px-3 py-2 font-medium text-xs transition-all"
                key={status}
                onClick={() => onStatusUpdate(status)}
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.72)",
                }}
                type="button"
              >
                {STATUS_ACTION_LABELS[status]}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
            This application is in a terminal state.
          </p>
        )}
      </div>
    </div>
  );
}

export function JobApplicationsClient({
  initialApplications,
  page,
  title,
  total,
}: JobApplicationsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [applications, setApplications] =
    useState<RecruitmentApplicationRecord[]>(initialApplications);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialApplications[0]?.$id ?? null
  );
  const [, startTransition] = useTransition();

  useEffect(() => {
    setApplications(initialApplications);
    setSelectedId((current) => {
      if (
        current &&
        initialApplications.some((application) => application.$id === current)
      ) {
        return current;
      }
      return initialApplications[0]?.$id ?? null;
    });
  }, [initialApplications]);

  const activeFilter = searchParams.get("status") ?? "all";
  const defaultSearch = searchParams.get("search") ?? "";

  const selectedApplication = useMemo(
    () =>
      applications.find((application) => application.$id === selectedId) ??
      null,
    [applications, selectedId]
  );

  function updateQueryParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (value.trim()) {
      params.set(key, value.trim());
    } else {
      params.delete(key);
    }
    params.delete("page");

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function handleStatusUpdate(nextStatus: JobApplicationStatus) {
    if (!selectedApplication) {
      return;
    }

    startTransition(async () => {
      const result = await updateJobApplicationStatus(selectedApplication.$id, {
        status: nextStatus,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      setApplications((current) =>
        current.map((application) =>
          application.$id === selectedApplication.$id
            ? { ...application, status: nextStatus }
            : application
        )
      );
      toast.success(`Application updated to ${nextStatus}`);
    });
  }

  if (applications.length === 0 && page === 1) {
    return (
      <EmptyState
        description="Applications will appear here after candidates submit them."
        icon={<Briefcase size={28} />}
        title="No applications yet"
      />
    );
  }

  return (
    <>
      <SearchToolbar
        activeFilter={activeFilter}
        defaultSearch={defaultSearch}
        filters={STATUS_FILTERS.map((filter) => ({
          label: filter.label,
          value: filter.value,
        }))}
        onFilterChange={(value) => updateQueryParam("status", value)}
        onSearch={(value) => updateQueryParam("search", value)}
        placeholder="Search applicants or vacancies"
      />

      {applications.length === 0 ? (
        <EmptyState
          description="Try adjusting the search or status filter."
          icon={<FileText size={28} />}
          title="No matching applications"
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(360px,0.8fr)]">
          <div className="space-y-2">
            {applications.map((application) => {
              const isSelected = application.$id === selectedId;

              return (
                <button
                  className="w-full rounded-2xl px-5 py-4 text-left transition-all"
                  key={application.$id}
                  onClick={() => setSelectedId(application.$id)}
                  style={{
                    background: isSelected
                      ? "rgba(61,169,224,0.10)"
                      : "rgba(255,255,255,0.02)",
                    border: isSelected
                      ? "1px solid rgba(61,169,224,0.35)"
                      : "1px solid rgba(255,255,255,0.05)",
                  }}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="truncate font-medium text-sm"
                          style={{ color: "#fff" }}
                        >
                          {application.applicant_name}
                        </span>
                        <StatusBadge status={application.status} />
                      </div>
                      <p
                        className="mt-1 truncate text-xs"
                        style={{ color: "rgba(255,255,255,0.55)" }}
                      >
                        {application.job?.title ?? title}
                      </p>
                    </div>
                    <p
                      className="shrink-0 text-xs"
                      style={{ color: "rgba(255,255,255,0.35)" }}
                    >
                      {new Date(application.$createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div
                    className="mt-3 flex flex-wrap items-center gap-3 text-xs"
                    style={{ color: "rgba(255,255,255,0.40)" }}
                  >
                    <span className="flex items-center gap-1.5">
                      <Mail size={12} />
                      {application.applicant_email}
                    </span>
                    {application.applicant_phone ? (
                      <span className="flex items-center gap-1.5">
                        <Phone size={12} />
                        {application.applicant_phone}
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>

          <div
            className="rounded-3xl p-6"
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <ApplicationDetailPanel
              application={selectedApplication}
              onStatusUpdate={handleStatusUpdate}
              title={title}
            />
          </div>
        </div>
      )}

      <PaginationBar page={page} total={total} />
    </>
  );
}
