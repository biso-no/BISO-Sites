"use client";

import { JobApplicationsStatus } from "@repo/api/types/appwrite";
import {
  getAllowedRecruitmentApplicationTransitions,
  parseRecruitmentAiScreening,
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
  Sparkles,
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
import { APPLICATIONS_PAGE_SIZE } from "../../_actions/schemas";
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
  { label: "Submitted", value: JobApplicationsStatus.SUBMITTED },
  { label: "Reviewed", value: JobApplicationsStatus.REVIEWED },
  { label: "Interview", value: JobApplicationsStatus.INTERVIEW },
  { label: "Accepted", value: JobApplicationsStatus.ACCEPTED },
  { label: "Rejected", value: JobApplicationsStatus.REJECTED },
] as const;

const STATUS_ACTION_LABELS: Record<JobApplicationsStatus, string> = {
  [JobApplicationsStatus.SUBMITTED]: "Mark submitted",
  [JobApplicationsStatus.REVIEWED]: "Mark reviewed",
  [JobApplicationsStatus.INTERVIEW]: "Move to interview",
  [JobApplicationsStatus.ACCEPTED]: "Accept candidate",
  [JobApplicationsStatus.REJECTED]: "Reject candidate",
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
      (application) => application.status === JobApplicationsStatus.ACCEPTED
    ).length,
    interview: applications.filter(
      (application) => application.status === JobApplicationsStatus.INTERVIEW
    ).length,
    pending: applications.filter(
      (application) => application.status === JobApplicationsStatus.SUBMITTED
    ).length,
    reviewed: applications.filter(
      (application) => application.status === JobApplicationsStatus.REVIEWED
    ).length,
  };
}

const inputStyle = {
  background: STUDIO.paper,
  border: `1px solid ${STUDIO.rule}`,
  color: STUDIO.ink,
};

function getScoreStyle(score: number) {
  if (score >= 70) {
    return {
      color: STUDIO.leaf,
      bg: "rgba(47,93,58,0.08)",
      border: "rgba(47,93,58,0.20)",
    };
  }
  if (score >= 40) {
    return {
      color: STUDIO.gold,
      bg: "rgba(176,138,62,0.10)",
      border: "rgba(176,138,62,0.22)",
    };
  }
  return {
    color: STUDIO.claret,
    bg: "rgba(107,30,30,0.08)",
    border: "rgba(107,30,30,0.20)",
  };
}

function ScreeningStrengthsAndConcerns({
  screening,
}: {
  screening: ReturnType<typeof parseRecruitmentAiScreening>;
}) {
  if (
    !screening ||
    (screening.strengths.length === 0 && screening.concerns.length === 0)
  ) {
    return null;
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {screening.strengths.length > 0 ? (
        <div>
          <p
            className="mb-1.5 text-xs uppercase tracking-[0.12em]"
            style={{ color: STUDIO.leaf }}
          >
            Strengths
          </p>
          <div className="flex flex-wrap gap-1.5">
            {screening.strengths.map((strength) => (
              <span
                className="rounded-full px-2.5 py-0.5 text-xs"
                key={strength}
                style={{
                  background: "rgba(47,93,58,0.08)",
                  color: STUDIO.leaf,
                }}
              >
                {strength}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {screening.concerns.length > 0 ? (
        <div>
          <p
            className="mb-1.5 text-xs uppercase tracking-[0.12em]"
            style={{ color: STUDIO.claret }}
          >
            Concerns
          </p>
          <div className="flex flex-wrap gap-1.5">
            {screening.concerns.map((concern) => (
              <span
                className="rounded-full px-2.5 py-0.5 text-xs"
                key={concern}
                style={{
                  background: "rgba(107,30,30,0.07)",
                  color: STUDIO.claret,
                }}
              >
                {concern}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AiScreeningPanel({
  application,
}: {
  application: RecruitmentApplicationRecord;
}) {
  if (application.screening_score == null) {
    return null;
  }

  const score = application.screening_score;
  const screening = parseRecruitmentAiScreening(application.ai_screening);
  const {
    color: scoreColor,
    bg: scoreBg,
    border: scoreBorder,
  } = getScoreStyle(score);

  const recommendationLabel: Record<string, string> = {
    interview: "→ Advance to Interview",
    reviewed: "→ Mark for Review",
    rejected: "→ Reject",
  };

  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: "rgba(61,169,224,0.04)",
        border: "1px solid rgba(61,169,224,0.18)",
      }}
    >
      <div className="mb-3 flex items-center gap-2">
        <Sparkles size={15} style={{ color: STUDIO.sky }} />
        <p className="font-medium text-sm" style={{ color: STUDIO.ink }}>
          AI Screening
        </p>
        <div className="ml-auto flex items-center gap-2">
          {screening?.recommended_status ? (
            <span
              className="rounded-full px-2.5 py-1 font-medium text-xs"
              style={{
                background: scoreBg,
                border: `1px solid ${scoreBorder}`,
                color: scoreColor,
              }}
            >
              {recommendationLabel[screening.recommended_status] ??
                screening.recommended_status}
            </span>
          ) : null}
          <span
            className="rounded-full px-3 py-1 font-medium text-sm"
            style={{
              background: scoreBg,
              border: `1px solid ${scoreBorder}`,
              color: scoreColor,
            }}
          >
            {score} / 100
          </span>
        </div>
      </div>

      {screening?.summary ? (
        <p className="mb-3 text-sm leading-6" style={{ color: STUDIO.ink3 }}>
          {screening.summary}
        </p>
      ) : null}

      <ScreeningStrengthsAndConcerns screening={screening} />

      {screening?.dimension_scores && screening.dimension_scores.length > 0 ? (
        <div className="mt-3 space-y-1.5">
          <p
            className="text-xs uppercase tracking-[0.12em]"
            style={{ color: STUDIO.ink4 }}
          >
            Dimension scores
          </p>
          {screening.dimension_scores.map((dim) => (
            <div className="flex items-center gap-3" key={dim.name}>
              <span
                className="w-32 shrink-0 truncate text-xs"
                style={{ color: STUDIO.ink3 }}
              >
                {dim.name}
              </span>
              <div
                className="flex-1 overflow-hidden rounded-full"
                style={{ background: STUDIO.paper3, height: 4 }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    background: STUDIO.sky,
                    width: `${(dim.score / 5) * 100}%`,
                  }}
                />
              </div>
              <span
                className="w-6 shrink-0 text-right text-xs"
                style={{ color: STUDIO.ink4 }}
              >
                {dim.score}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
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
          style={{ color: STUDIO.ink4 }}
        >
          HRM Process
        </p>
        <div
          className="rounded-2xl p-4"
          style={{
            background: STUDIO.paper2,
            border: `1px solid ${STUDIO.rule}`,
          }}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-2 text-xs">
              <span style={{ color: STUDIO.ink4 }}>Assigned HR member</span>
              <select
                className="w-full rounded-xl px-3 py-2 text-sm outline-none"
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
                style={inputStyle}
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
              <span style={{ color: STUDIO.ink4 }}>Candidate score</span>
              <select
                className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                onChange={(event) =>
                  patchDraft({
                    score: event.target.value
                      ? Number(event.target.value)
                      : null,
                  })
                }
                style={inputStyle}
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
            <span style={{ color: STUDIO.ink4 }}>Review notes</span>
            <textarea
              className="min-h-24 w-full rounded-xl px-3 py-2 text-sm outline-none"
              onChange={(event) =>
                patchDraft({ review_notes: event.target.value || null })
              }
              placeholder="Internal HR notes, screening outcome, questions to ask..."
              style={inputStyle}
              value={draft.review_notes ?? ""}
            />
          </label>
        </div>
      </div>

      <div>
        <p
          className="mb-3 text-xs uppercase tracking-[0.2em]"
          style={{ color: STUDIO.ink4 }}
        >
          Availability
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <div
            className="rounded-2xl p-4"
            style={{
              background: STUDIO.paper2,
              border: `1px solid ${STUDIO.rule}`,
            }}
          >
            <p
              className="mb-2 font-medium text-sm"
              style={{ color: STUDIO.ink }}
            >
              Candidate
            </p>
            {candidateSlots.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {candidateSlots.map((slot) => (
                  <span
                    className="rounded-full px-2.5 py-1 text-xs"
                    key={slot}
                    style={{
                      background: "rgba(42,74,122,0.08)",
                      color: STUDIO.sky,
                    }}
                  >
                    {slot}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm" style={{ color: STUDIO.ink4 }}>
                No availability submitted.
              </p>
            )}
          </div>
          <label
            className="block rounded-2xl p-4 text-xs"
            style={{
              background: STUDIO.paper2,
              border: `1px solid ${STUDIO.rule}`,
            }}
          >
            <span className="font-medium text-sm" style={{ color: STUDIO.ink }}>
              HR availability
            </span>
            <textarea
              className="mt-2 min-h-24 w-full rounded-xl px-3 py-2 text-sm outline-none"
              onChange={(event) =>
                patchDraft({ hr_availability: textToSlots(event.target.value) })
              }
              placeholder="Times the assigned HR member can do interviews."
              style={inputStyle}
              value={slotsToText(draft.hr_availability)}
            />
          </label>
        </div>
      </div>

      <div
        className="rounded-2xl p-4"
        style={{
          background: STUDIO.paper2,
          border: `1px solid ${STUDIO.rule}`,
        }}
      >
        <div className="mb-3 flex items-center gap-2">
          <CalendarClock size={16} style={{ color: STUDIO.sky }} />
          <p className="font-medium text-sm" style={{ color: STUDIO.ink }}>
            Interview plan
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-2 text-xs">
            <span style={{ color: STUDIO.ink4 }}>Status</span>
            <select
              className="w-full rounded-xl px-3 py-2 text-sm outline-none"
              onChange={(event) =>
                patchDraft({
                  interview_status: event.target
                    .value as RecruitmentApplicationReviewMetadata["interview_status"],
                })
              }
              style={inputStyle}
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
            <span style={{ color: STUDIO.ink4 }}>Start time</span>
            <input
              className="w-full rounded-xl px-3 py-2 text-sm outline-none"
              onChange={(event) =>
                patchDraft({ interview_starts_at: event.target.value || null })
              }
              style={inputStyle}
              type="datetime-local"
              value={toDateTimeInput(draft.interview_starts_at)}
            />
          </label>
          <label className="space-y-2 text-xs">
            <span style={{ color: STUDIO.ink4 }}>Duration</span>
            <input
              className="w-full rounded-xl px-3 py-2 text-sm outline-none"
              min={15}
              onChange={(event) =>
                patchDraft({
                  interview_duration_minutes: event.target.value
                    ? Number(event.target.value)
                    : null,
                })
              }
              step={15}
              style={inputStyle}
              type="number"
              value={draft.interview_duration_minutes ?? ""}
            />
          </label>
          <label className="space-y-2 text-xs">
            <span style={{ color: STUDIO.ink4 }}>Location</span>
            <input
              className="w-full rounded-xl px-3 py-2 text-sm outline-none"
              onChange={(event) =>
                patchDraft({ interview_location: event.target.value || null })
              }
              placeholder="Room, campus or Teams"
              style={inputStyle}
              value={draft.interview_location ?? ""}
            />
          </label>
        </div>
        <label className="mt-3 block space-y-2 text-xs">
          <span style={{ color: STUDIO.ink4 }}>Meeting URL</span>
          <input
            className="w-full rounded-xl px-3 py-2 text-sm outline-none"
            onChange={(event) =>
              patchDraft({ interview_meeting_url: event.target.value || null })
            }
            placeholder="https://..."
            style={inputStyle}
            value={draft.interview_meeting_url ?? ""}
          />
        </label>
        <label className="mt-3 block space-y-2 text-xs">
          <span style={{ color: STUDIO.ink4 }}>Interview notes</span>
          <textarea
            className="min-h-20 w-full rounded-xl px-3 py-2 text-sm outline-none"
            onChange={(event) =>
              patchDraft({ interview_notes: event.target.value || null })
            }
            placeholder="Questions, assessment criteria, follow-up..."
            style={inputStyle}
            value={draft.interview_notes ?? ""}
          />
        </label>
      </div>

      <button
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-medium text-sm transition-all"
        disabled={isSaving}
        onClick={onSave}
        style={{
          background: STUDIO.ink,
          color: STUDIO.paper,
          opacity: isSaving ? 0.65 : 1,
        }}
        type="button"
      >
        <Users size={15} />
        {isSaving ? "Saving process..." : "Save recruitment process"}
      </button>
      {application.review_metadata.last_reviewed_at ? (
        <p className="text-center text-xs" style={{ color: STUDIO.ink4 }}>
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
  onStatusUpdate: (status: JobApplicationsStatus) => void;
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
              style={{ color: STUDIO.ink }}
            >
              {application.applicant_name}
            </h2>
            <StatusBadge size="md" status={application.status} />
          </div>
          <p className="mt-1 text-sm" style={{ color: STUDIO.ink4 }}>
            {application.job?.title ?? title}
          </p>
        </div>

        {application.job ? (
          <Link
            className="rounded-xl px-3 py-2 text-xs transition-all"
            href={`/jobs/${application.job.$id}`}
            style={{
              background: STUDIO.paper2,
              border: `1px solid ${STUDIO.rule}`,
              color: STUDIO.ink3,
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
            background: STUDIO.paper2,
            border: `1px solid ${STUDIO.rule}`,
          }}
        >
          <p
            className="mb-3 text-xs uppercase tracking-[0.2em]"
            style={{ color: STUDIO.ink4 }}
          >
            Candidate
          </p>
          <div className="space-y-2 text-sm">
            <p
              className="flex items-center gap-2"
              style={{ color: STUDIO.ink }}
            >
              <UserRound size={14} />
              {application.applicant_name}
            </p>
            <p style={{ color: STUDIO.ink3 }}>{application.applicant_email}</p>
            <p style={{ color: STUDIO.ink3 }}>
              {application.applicant_phone ?? "No phone provided"}
            </p>
          </div>
        </div>

        <div
          className="rounded-2xl p-4"
          style={{
            background: STUDIO.paper2,
            border: `1px solid ${STUDIO.rule}`,
          }}
        >
          <p
            className="mb-3 text-xs uppercase tracking-[0.2em]"
            style={{ color: STUDIO.ink4 }}
          >
            Processing
          </p>
          <div className="space-y-2 text-sm">
            <p style={{ color: STUDIO.ink3 }}>
              Submitted {formatDateTime(application.$createdAt)}
            </p>
            <p style={{ color: STUDIO.ink3 }}>
              Consent recorded {formatDateTime(application.consent_date)}
            </p>
            <p style={{ color: STUDIO.ink3 }}>
              Retention until {formatDateTime(application.data_retention_until)}
            </p>
          </div>
        </div>
      </div>

      <AiScreeningPanel application={application} />

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
            style={{ color: STUDIO.ink4 }}
          >
            Application Materials
          </p>
          {application.resume_file_id ? (
            <a
              className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs transition-all"
              href={`/api/recruitment/applications/${application.$id}/resume`}
              style={{
                background: "rgba(42,74,122,0.06)",
                border: "1px solid rgba(42,74,122,0.20)",
                color: STUDIO.sky,
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
            background: STUDIO.paper2,
            border: `1px solid ${STUDIO.rule}`,
          }}
        >
          <p className="mb-2 font-medium text-sm" style={{ color: STUDIO.ink }}>
            Cover letter
          </p>
          <p
            className="whitespace-pre-wrap text-sm leading-6"
            style={{ color: STUDIO.ink3 }}
          >
            {application.cover_letter?.trim() || "No cover letter provided."}
          </p>
        </div>
      </div>

      <div>
        <p
          className="mb-3 text-xs uppercase tracking-[0.2em]"
          style={{ color: STUDIO.ink4 }}
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
                  background: STUDIO.paper2,
                  border: `1px solid ${STUDIO.rule2}`,
                  color: STUDIO.ink2,
                }}
                type="button"
              >
                {STATUS_ACTION_LABELS[status]}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm" style={{ color: STUDIO.ink4 }}>
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
      // This legacy assign-reviewer view has no other-campus opt-in, so only
      // surface the in-scope (primary) reviewers.
      setReviewers(result.data.filter((item) => item.scope === "primary"));
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

  function handleStatusUpdate(nextStatus: JobApplicationsStatus) {
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
    <div className="space-y-4">
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
                      ? "rgba(61,169,224,0.08)"
                      : STUDIO.paper2,
                    border: isSelected
                      ? "1px solid rgba(61,169,224,0.30)"
                      : `1px solid ${STUDIO.rule}`,
                  }}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="truncate font-medium text-sm"
                          style={{ color: STUDIO.ink }}
                        >
                          {application.applicant_name}
                        </span>
                        <StatusBadge status={application.status} />
                      </div>
                      <p
                        className="mt-1 truncate text-xs"
                        style={{ color: STUDIO.ink4 }}
                      >
                        {application.job?.title ?? title}
                      </p>
                    </div>
                    <p
                      className="shrink-0 text-xs"
                      style={{ color: STUDIO.ink4 }}
                    >
                      {new Date(application.$createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div
                    className="mt-3 flex flex-wrap items-center gap-3 text-xs"
                    style={{ color: STUDIO.ink4 }}
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
              background: STUDIO.paper,
              border: `1px solid ${STUDIO.rule}`,
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

      <PaginationBar page={page} size={APPLICATIONS_PAGE_SIZE} total={total} />
    </div>
  );
}
