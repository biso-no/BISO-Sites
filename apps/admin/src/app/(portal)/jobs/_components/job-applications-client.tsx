"use client";

import { JobApplicationStatus } from "@repo/api/types/appwrite";
import {
  getAllowedRecruitmentApplicationTransitions,
  type RecruitmentApplicationRecord,
  type RecruitmentApplicationReviewMetadata,
} from "@repo/shared/types/recruitment";
import {
  Briefcase,
  CalendarClock,
  Download,
  FileText,
  Mail,
  Phone,
  Star,
  UserRound,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  listRecruitmentReviewers,
  type RecruitmentReviewerOption,
  updateJobApplicationReview,
  updateJobApplicationStatus,
} from "../../_actions/jobs";
import { EmptyState } from "../../_components/empty-state";
import { PaginationBar } from "../../_components/pagination-bar";
import { SearchToolbar } from "../../_components/search-toolbar";
import { StatusBadge } from "../../_components/status-badge";
import { STUDIO, studioSurface } from "../../_components/studio";

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

const INTERVIEW_STATUS_OPTIONS = [
  { label: "No interview", value: "none" },
  { label: "Requested", value: "requested" },
  { label: "Scheduled", value: "scheduled" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
] as const;

const AVAILABILITY_SPLIT_PATTERN = /\r?\n|,/;

function slotsToText(slots: string[] | undefined): string {
  return (slots ?? []).join("\n");
}

function textToSlots(value: string): string[] {
  return value
    .split(AVAILABILITY_SPLIT_PATTERN)
    .map((slot) => slot.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function toDateTimeInput(value: string | null | undefined): string {
  return value ? value.slice(0, 16) : "";
}

function pipelineStats(applications: RecruitmentApplicationRecord[]) {
  return {
    accepted: applications.filter(
      (application) => application.status === JobApplicationStatus.ACCEPTED
    ).length,
    interview: applications.filter(
      (application) => application.status === JobApplicationStatus.INTERVIEW
    ).length,
    pending: applications.filter(
      (application) => application.status === JobApplicationStatus.SUBMITTED
    ).length,
    reviewed: applications.filter(
      (application) => application.status === JobApplicationStatus.REVIEWED
    ).length,
  };
}

interface RecruitmentProcessPanelProps {
  application: RecruitmentApplicationRecord;
  draft: RecruitmentApplicationReviewMetadata;
  isSaving: boolean;
  onChange: (draft: RecruitmentApplicationReviewMetadata) => void;
  onSave: () => void;
  reviewers: RecruitmentReviewerOption[];
}

function RecruitmentProcessPanel({
  application,
  draft,
  isSaving,
  onChange,
  onSave,
  reviewers,
}: RecruitmentProcessPanelProps) {
  const candidateSlots = draft.candidate_availability ?? [];
  const selectedReviewerId = draft.assigned_hr_user_id ?? "";

  function patchDraft(patch: Partial<RecruitmentApplicationReviewMetadata>) {
    onChange({ ...draft, ...patch });
  }

  return (
    <div className="space-y-5">
      <div>
        <p
          className="mb-3 text-xs uppercase tracking-[0.2em]"
          style={{ color: "rgba(255,255,255,0.30)" }}
        >
          HRM Process
        </p>
        <div
          className="rounded-2xl p-4"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-2 text-xs">
              <span style={{ color: "rgba(255,255,255,0.45)" }}>
                Assigned HR member
              </span>
              <select
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
                onChange={(event) => {
                  const reviewer = reviewers.find(
                    (item) => item.id === event.target.value
                  );
                  patchDraft({
                    assigned_hr_user_email: reviewer?.email ?? null,
                    assigned_hr_user_id: reviewer?.id ?? null,
                    assigned_hr_user_name: reviewer?.name ?? null,
                  });
                }}
                value={selectedReviewerId}
              >
                <option value="">Unassigned</option>
                {reviewers.map((reviewer) => (
                  <option key={reviewer.id} value={reviewer.id}>
                    {reviewer.name}
                    {reviewer.email ? ` · ${reviewer.email}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-xs">
              <span style={{ color: "rgba(255,255,255,0.45)" }}>
                Candidate score
              </span>
              <select
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
                onChange={(event) =>
                  patchDraft({
                    score: event.target.value
                      ? Number(event.target.value)
                      : null,
                  })
                }
                value={draft.score ?? ""}
              >
                <option value="">Not scored</option>
                {[1, 2, 3, 4, 5].map((score) => (
                  <option key={score} value={score}>
                    {score} / 5
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="mt-3 block space-y-2 text-xs">
            <span style={{ color: "rgba(255,255,255,0.45)" }}>
              Review notes
            </span>
            <textarea
              className="min-h-24 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
              onChange={(event) =>
                patchDraft({ review_notes: event.target.value || null })
              }
              placeholder="Internal HR notes, screening outcome, questions to ask..."
              value={draft.review_notes ?? ""}
            />
          </label>
        </div>
      </div>

      <div>
        <p
          className="mb-3 text-xs uppercase tracking-[0.2em]"
          style={{ color: "rgba(255,255,255,0.30)" }}
        >
          Availability
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <div
            className="rounded-2xl p-4"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <p className="mb-2 font-medium text-sm" style={{ color: "#fff" }}>
              Candidate
            </p>
            {candidateSlots.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {candidateSlots.map((slot) => (
                  <span
                    className="rounded-full px-2.5 py-1 text-xs"
                    key={slot}
                    style={{
                      background: "rgba(61,169,224,0.10)",
                      color: "#7dd3fc",
                    }}
                  >
                    {slot}
                  </span>
                ))}
              </div>
            ) : (
              <p
                className="text-sm"
                style={{ color: "rgba(255,255,255,0.45)" }}
              >
                No availability submitted.
              </p>
            )}
          </div>
          <label
            className="block rounded-2xl p-4 text-xs"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <span className="font-medium text-sm" style={{ color: "#fff" }}>
              HR availability
            </span>
            <textarea
              className="mt-2 min-h-24 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
              onChange={(event) =>
                patchDraft({ hr_availability: textToSlots(event.target.value) })
              }
              placeholder="Times the assigned HR member can do interviews."
              value={slotsToText(draft.hr_availability)}
            />
          </label>
        </div>
      </div>

      <div
        className="rounded-2xl p-4"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="mb-3 flex items-center gap-2">
          <CalendarClock size={16} style={{ color: "#3DA9E0" }} />
          <p className="font-medium text-sm" style={{ color: "#fff" }}>
            Interview plan
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-2 text-xs">
            <span style={{ color: "rgba(255,255,255,0.45)" }}>Status</span>
            <select
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
              onChange={(event) =>
                patchDraft({
                  interview_status: event.target
                    .value as RecruitmentApplicationReviewMetadata["interview_status"],
                })
              }
              value={draft.interview_status ?? "none"}
            >
              {INTERVIEW_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-xs">
            <span style={{ color: "rgba(255,255,255,0.45)" }}>Start time</span>
            <input
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
              onChange={(event) =>
                patchDraft({ interview_starts_at: event.target.value || null })
              }
              type="datetime-local"
              value={toDateTimeInput(draft.interview_starts_at)}
            />
          </label>
          <label className="space-y-2 text-xs">
            <span style={{ color: "rgba(255,255,255,0.45)" }}>Duration</span>
            <input
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
              min={15}
              onChange={(event) =>
                patchDraft({
                  interview_duration_minutes: event.target.value
                    ? Number(event.target.value)
                    : null,
                })
              }
              step={15}
              type="number"
              value={draft.interview_duration_minutes ?? ""}
            />
          </label>
          <label className="space-y-2 text-xs">
            <span style={{ color: "rgba(255,255,255,0.45)" }}>Location</span>
            <input
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
              onChange={(event) =>
                patchDraft({ interview_location: event.target.value || null })
              }
              placeholder="Room, campus or Teams"
              value={draft.interview_location ?? ""}
            />
          </label>
        </div>
        <label className="mt-3 block space-y-2 text-xs">
          <span style={{ color: "rgba(255,255,255,0.45)" }}>Meeting URL</span>
          <input
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
            onChange={(event) =>
              patchDraft({ interview_meeting_url: event.target.value || null })
            }
            placeholder="https://..."
            value={draft.interview_meeting_url ?? ""}
          />
        </label>
        <label className="mt-3 block space-y-2 text-xs">
          <span style={{ color: "rgba(255,255,255,0.45)" }}>
            Interview notes
          </span>
          <textarea
            className="min-h-20 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
            onChange={(event) =>
              patchDraft({ interview_notes: event.target.value || null })
            }
            placeholder="Questions, assessment criteria, follow-up..."
            value={draft.interview_notes ?? ""}
          />
        </label>
      </div>

      <button
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-medium text-sm transition-all"
        disabled={isSaving}
        onClick={onSave}
        style={{
          background: "#3DA9E0",
          color: "#001731",
          opacity: isSaving ? 0.65 : 1,
        }}
        type="button"
      >
        <Users size={15} />
        {isSaving ? "Saving process..." : "Save recruitment process"}
      </button>
      {application.review_metadata.last_reviewed_at ? (
        <p
          className="text-center text-xs"
          style={{ color: "rgba(255,255,255,0.35)" }}
        >
          Last reviewed{" "}
          {formatDateTime(application.review_metadata.last_reviewed_at)}
        </p>
      ) : null}
    </div>
  );
}

interface ApplicationDetailPanelProps {
  application: RecruitmentApplicationRecord | null;
  draft: RecruitmentApplicationReviewMetadata | null;
  isSavingReview: boolean;
  onReviewDraftChange: (draft: RecruitmentApplicationReviewMetadata) => void;
  onReviewSave: () => void;
  onStatusUpdate: (status: JobApplicationStatus) => void;
  reviewers: RecruitmentReviewerOption[];
  title: string;
}

function ApplicationDetailPanel({
  application,
  draft,
  isSavingReview,
  onReviewDraftChange,
  onReviewSave,
  onStatusUpdate,
  reviewers,
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
  const reviewMetadata = draft ?? application.review_metadata;

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

      <RecruitmentProcessPanel
        application={application}
        draft={reviewMetadata}
        isSaving={isSavingReview}
        onChange={onReviewDraftChange}
        onSave={onReviewSave}
        reviewers={reviewers}
      />

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
  const [reviewers, setReviewers] = useState<RecruitmentReviewerOption[]>([]);
  const [reviewDraft, setReviewDraft] =
    useState<RecruitmentApplicationReviewMetadata | null>(
      initialApplications[0]?.review_metadata ?? null
    );
  const [isSavingReview, setIsSavingReview] = useState(false);
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
  const stats = useMemo(() => pipelineStats(applications), [applications]);

  useEffect(() => {
    setReviewDraft(selectedApplication?.review_metadata ?? null);

    if (!selectedApplication?.job_id) {
      setReviewers([]);
      return;
    }

    let cancelled = false;
    listRecruitmentReviewers(selectedApplication.job_id).then((result) => {
      if (cancelled) {
        return;
      }
      if (result.error) {
        toast.error(result.error);
        setReviewers([]);
        return;
      }
      if (!result.data) {
        setReviewers([]);
        return;
      }
      setReviewers(result.data);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedApplication]);

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
      if (!result.data) {
        toast.error("Failed to update recruitment process");
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

  function handleReviewSave() {
    if (!(selectedApplication && reviewDraft)) {
      return;
    }

    setIsSavingReview(true);
    startTransition(async () => {
      const result = await updateJobApplicationReview(
        selectedApplication.$id,
        reviewDraft
      );
      setIsSavingReview(false);

      if (result.error) {
        toast.error(result.error);
        return;
      }
      const updatedMetadata = result.data as
        | RecruitmentApplicationReviewMetadata
        | undefined;
      if (!updatedMetadata) {
        toast.error("Failed to update recruitment process");
        return;
      }

      setApplications((current) =>
        current.map((application) =>
          application.$id === selectedApplication.$id
            ? { ...application, review_metadata: updatedMetadata }
            : application
        )
      );
      setReviewDraft(updatedMetadata);
      toast.success("Recruitment process saved");
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
    <div className="job-applications-parchment">
      <style>{`
        .job-applications-parchment [class*="text-white"] {
          color: ${STUDIO.ink2} !important;
        }
        .job-applications-parchment [class*="text-white/"] {
          color: ${STUDIO.ink4} !important;
        }
        .job-applications-parchment [class*="border-white"] {
          border-color: ${STUDIO.rule2} !important;
        }
        .job-applications-parchment [class*="bg-white/"] {
          background: rgba(255,255,255,0.55) !important;
        }
      `}</style>
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

      <div className="grid gap-3 md:grid-cols-4" style={{ color: STUDIO.ink3 }}>
        {[
          {
            icon: FileText,
            label: "Pending review",
            value: stats.pending,
          },
          {
            icon: Star,
            label: "Reviewed",
            value: stats.reviewed,
          },
          {
            icon: CalendarClock,
            label: "Interview",
            value: stats.interview,
          },
          {
            icon: Briefcase,
            label: "Accepted",
            value: stats.accepted,
          },
        ].map(({ icon: Icon, label, value }) => (
          <div className="rounded-2xl p-4" key={label} style={studioSurface}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs uppercase tracking-[0.18em]">
                {label}
              </span>
              <Icon size={16} style={{ color: STUDIO.claret }} />
            </div>
            <p
              className="mt-2 font-light text-3xl"
              style={{ color: STUDIO.ink }}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

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
              draft={reviewDraft}
              isSavingReview={isSavingReview}
              onReviewDraftChange={setReviewDraft}
              onReviewSave={handleReviewSave}
              onStatusUpdate={handleStatusUpdate}
              reviewers={reviewers}
              title={title}
            />
          </div>
        </div>
      )}

      <PaginationBar page={page} total={total} />
    </div>
  );
}
