"use client";

import type {
  JobInterviewScorecards,
  JobInterviews,
} from "@repo/api/types/appwrite";
import {
  InterviewParticipantRole,
  InterviewStatus,
} from "@repo/api/types/appwrite";
import type {
  RecruitmentInterviewCreateInput,
  RecruitmentScorecardCriterion,
} from "@repo/shared/types/recruitment";
import {
  CalendarClock,
  Clock,
  MapPin,
  Plus,
  Users,
  Video,
  X,
} from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  addInterviewParticipant,
  cancelInterview,
  createInterview,
  type InterviewWithParticipants,
  removeInterviewParticipant,
  type ScorecardWithSummary,
  updateInterview,
} from "../../_actions/interviews";
import type { RecruitmentReviewerOption } from "../../_actions/jobs";
import { JobInterviewScorecardForm } from "./job-interview-scorecard-form";

interface Props {
  applicantEmail: string;
  applicantName: string;
  applicationId: string;
  currentUserId: string;
  initialInterviews: InterviewWithParticipants[];
  reviewers: RecruitmentReviewerOption[];
  scorecardsByInterview: Map<string, ScorecardWithSummary[]>;
}

function toDateTimeInputValue(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  // datetime-local needs yyyy-MM-ddThh:mm (no seconds)
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDateRange(
  startsAt: string | null,
  endsAt: string | null
): string {
  if (!startsAt) {
    return "No time set";
  }
  const s = new Date(startsAt);
  if (Number.isNaN(s.getTime())) {
    return "Invalid time";
  }
  if (!endsAt) {
    return s.toLocaleString();
  }
  const e = new Date(endsAt);
  if (Number.isNaN(e.getTime())) {
    return s.toLocaleString();
  }
  return `${s.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} → ${e.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;
}

export function JobInterviewPanel({
  applicationId,
  applicantName,
  applicantEmail,
  initialInterviews,
  reviewers,
  currentUserId,
  scorecardsByInterview,
}: Props) {
  const [interviews, setInterviews] =
    useState<InterviewWithParticipants[]>(initialInterviews);
  const [scorecards, setScorecards] = useState<
    Map<string, ScorecardWithSummary[]>
  >(scorecardsByInterview);
  const [isCreating, setIsCreating] = useState(false);
  const [createDraft, setCreateDraft] = useState<{
    title: string;
    starts_at: string;
    ends_at: string;
    location: string;
    meeting_url: string;
    notes: string;
    participantIds: string[];
  }>({
    ends_at: "",
    location: "",
    meeting_url: "",
    notes: "",
    participantIds: [],
    starts_at: "",
    title: `Interview round ${initialInterviews.length + 1}`,
  });
  const [isPending, startTransition] = useTransition();

  function toggleParticipant(userId: string) {
    setCreateDraft((draft) => ({
      ...draft,
      participantIds: draft.participantIds.includes(userId)
        ? draft.participantIds.filter((id) => id !== userId)
        : [...draft.participantIds, userId],
    }));
  }

  function handleCreate() {
    if (!(createDraft.starts_at && createDraft.ends_at)) {
      toast.error("Set a start and end time.");
      return;
    }
    if (createDraft.participantIds.length === 0) {
      toast.error("Pick at least one interviewer.");
      return;
    }
    const participants: RecruitmentInterviewCreateInput["participants"] =
      createDraft.participantIds.map((id, index) => {
        const reviewer = reviewers.find((entry) => entry.id === id);
        return {
          display_name: reviewer?.name ?? null,
          email: reviewer?.email ?? `${id}@biso.no`,
          is_lead: index === 0,
          role: "interviewer" as const,
          user_id: id,
        };
      });

    const payload: RecruitmentInterviewCreateInput = {
      application_id: applicationId,
      auto_create_teams_meeting: true,
      ends_at: new Date(createDraft.ends_at).toISOString(),
      location: createDraft.location || null,
      meeting_url: createDraft.meeting_url || null,
      notes: createDraft.notes || null,
      participants,
      round: interviews.length + 1,
      starts_at: new Date(createDraft.starts_at).toISOString(),
      timezone: "Europe/Oslo",
      title: createDraft.title || `Interview round ${interviews.length + 1}`,
    };

    startTransition(async () => {
      const result = await createInterview(payload);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.data) {
        toast.success("Interview scheduled");
        setInterviews((existing) => [
          ...existing,
          result.data as InterviewWithParticipants,
        ]);
        setIsCreating(false);
        setCreateDraft({
          ends_at: "",
          location: "",
          meeting_url: "",
          notes: "",
          participantIds: [],
          starts_at: "",
          title: `Interview round ${interviews.length + 2}`,
        });
      }
    });
  }

  function handleUpdateField(
    interviewId: string,
    patch: Partial<JobInterviews>
  ) {
    startTransition(async () => {
      const result = await updateInterview(interviewId, patch as never);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.data) {
        const updatedInterview = result.data;
        setInterviews((existing) =>
          existing.map((entry) =>
            entry.interview.$id === interviewId
              ? { ...entry, interview: updatedInterview }
              : entry
          )
        );
      }
    });
  }

  function handleCancel(interviewId: string) {
    if (!confirm("Cancel this interview? Participants will be notified.")) {
      return;
    }
    startTransition(async () => {
      const result = await cancelInterview(interviewId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.data) {
        const cancelled = result.data;
        setInterviews((existing) =>
          existing.map((entry) =>
            entry.interview.$id === interviewId
              ? { ...entry, interview: cancelled }
              : entry
          )
        );
        toast.success("Interview cancelled");
      }
    });
  }

  function handleAddParticipant(interviewId: string, userId: string) {
    const reviewer = reviewers.find((entry) => entry.id === userId);
    if (!reviewer) {
      return;
    }
    startTransition(async () => {
      const result = await addInterviewParticipant(interviewId, {
        display_name: reviewer.name,
        email: reviewer.email ?? `${reviewer.id}@biso.no`,
        role: "interviewer",
        user_id: reviewer.id,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.data) {
        const added = result.data;
        setInterviews((existing) =>
          existing.map((entry) =>
            entry.interview.$id === interviewId
              ? {
                  ...entry,
                  participants: [...entry.participants, added],
                }
              : entry
          )
        );
      }
    });
  }

  function handleRemoveParticipant(interviewId: string, participantId: string) {
    startTransition(async () => {
      const result = await removeInterviewParticipant(
        interviewId,
        participantId
      );
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setInterviews((existing) =>
        existing.map((entry) =>
          entry.interview.$id === interviewId
            ? {
                ...entry,
                participants: entry.participants.filter(
                  (participant) => participant.$id !== participantId
                ),
              }
            : entry
        )
      );
    });
  }

  function handleScorecardSubmitted(
    interviewId: string,
    scorecard: JobInterviewScorecards,
    criteria: RecruitmentScorecardCriterion[]
  ) {
    setScorecards((existing) => {
      const next = new Map(existing);
      const list = next.get(interviewId) ?? [];
      const filtered = list.filter(
        (entry) =>
          entry.scorecard.interviewer_user_id !== scorecard.interviewer_user_id
      );
      next.set(interviewId, [...filtered, { criteria, scorecard }]);
      return next;
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarClock size={16} style={{ color: "#3DA9E0" }} />
          <h3 className="font-medium text-sm" style={{ color: "#fff" }}>
            Interview pipeline
          </h3>
          <span
            className="rounded-full px-2 py-0.5 text-xs"
            style={{
              background: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.5)",
            }}
          >
            {interviews.length} {interviews.length === 1 ? "round" : "rounds"}
          </span>
        </div>
        <button
          className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs"
          onClick={() => setIsCreating((current) => !current)}
          style={{
            background: "rgba(61,169,224,0.16)",
            border: "1px solid rgba(61,169,224,0.32)",
            color: "#7dd3fc",
          }}
          type="button"
        >
          <Plus size={13} />
          New round
        </button>
      </div>

      {isCreating ? (
        <div
          className="space-y-3 rounded-2xl p-4"
          style={{
            background: "rgba(61,169,224,0.04)",
            border: "1px solid rgba(61,169,224,0.16)",
          }}
        >
          <input
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
            onChange={(event) =>
              setCreateDraft({ ...createDraft, title: event.target.value })
            }
            placeholder="Round title"
            value={createDraft.title}
          />
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-2 text-xs">
              <span style={{ color: "rgba(255,255,255,0.45)" }}>Starts</span>
              <input
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
                onChange={(event) =>
                  setCreateDraft({
                    ...createDraft,
                    starts_at: event.target.value,
                  })
                }
                type="datetime-local"
                value={createDraft.starts_at}
              />
            </label>
            <label className="space-y-2 text-xs">
              <span style={{ color: "rgba(255,255,255,0.45)" }}>Ends</span>
              <input
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
                onChange={(event) =>
                  setCreateDraft({
                    ...createDraft,
                    ends_at: event.target.value,
                  })
                }
                type="datetime-local"
                value={createDraft.ends_at}
              />
            </label>
            <label className="space-y-2 text-xs">
              <span style={{ color: "rgba(255,255,255,0.45)" }}>Location</span>
              <input
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
                onChange={(event) =>
                  setCreateDraft({
                    ...createDraft,
                    location: event.target.value,
                  })
                }
                placeholder="Room or Teams"
                value={createDraft.location}
              />
            </label>
            <label className="space-y-2 text-xs">
              <span style={{ color: "rgba(255,255,255,0.45)" }}>
                Meeting URL
              </span>
              <input
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
                onChange={(event) =>
                  setCreateDraft({
                    ...createDraft,
                    meeting_url: event.target.value,
                  })
                }
                placeholder="https://..."
                value={createDraft.meeting_url}
              />
            </label>
          </div>
          <div className="space-y-2 text-xs">
            <p style={{ color: "rgba(255,255,255,0.45)" }}>Panel</p>
            <div className="flex flex-wrap gap-2">
              {reviewers.map((reviewer) => {
                const selected = createDraft.participantIds.includes(
                  reviewer.id
                );
                return (
                  <button
                    className="rounded-full px-3 py-1 text-xs transition-all"
                    key={reviewer.id}
                    onClick={() => toggleParticipant(reviewer.id)}
                    style={{
                      background: selected
                        ? "rgba(61,169,224,0.18)"
                        : "rgba(255,255,255,0.04)",
                      border: `1px solid ${selected ? "#3DA9E0" : "rgba(255,255,255,0.08)"}`,
                      color: selected ? "#7dd3fc" : "rgba(255,255,255,0.65)",
                    }}
                    type="button"
                  >
                    {reviewer.name}
                  </button>
                );
              })}
            </div>
          </div>
          <textarea
            className="min-h-16 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
            onChange={(event) =>
              setCreateDraft({ ...createDraft, notes: event.target.value })
            }
            placeholder="Agenda / questions to cover"
            value={createDraft.notes}
          />
          <div className="flex items-center justify-end gap-2">
            <button
              className="rounded-xl px-3 py-2 text-xs"
              onClick={() => setIsCreating(false)}
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.6)",
              }}
              type="button"
            >
              Cancel
            </button>
            <button
              className="rounded-xl px-4 py-2 font-medium text-xs"
              disabled={isPending}
              onClick={handleCreate}
              style={{ background: "#3DA9E0", color: "#001731" }}
              type="button"
            >
              {isPending ? "Scheduling..." : "Schedule interview"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="space-y-4">
        {interviews.length === 0 ? (
          <p
            className="rounded-2xl p-4 text-sm"
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px dashed rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            No interviews scheduled yet. Start with “New round” above.
          </p>
        ) : null}

        {interviews
          .slice()
          .sort((a, b) => a.interview.round - b.interview.round)
          .map(({ interview, participants }) => {
            const interviewerParticipants = participants.filter(
              (participant) =>
                participant.role === InterviewParticipantRole.INTERVIEWER
            );
            const candidate = participants.find(
              (participant) =>
                participant.role === InterviewParticipantRole.CANDIDATE
            );
            const sCards = scorecards.get(interview.$id) ?? [];
            const userIsParticipant = interviewerParticipants.some(
              (participant) => participant.user_id === currentUserId
            );
            const userScorecard = sCards.find(
              (entry) => entry.scorecard.interviewer_user_id === currentUserId
            );

            return (
              <div
                className="space-y-3 rounded-2xl p-4"
                key={interview.$id}
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  opacity:
                    interview.status === InterviewStatus.CANCELLED ? 0.5 : 1,
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p
                      className="font-medium text-sm"
                      style={{ color: "#fff" }}
                    >
                      Round {interview.round} · {interview.title}
                    </p>
                    <p
                      className="mt-1 flex items-center gap-1 text-xs"
                      style={{ color: "rgba(255,255,255,0.55)" }}
                    >
                      <Clock size={12} />
                      {formatDateRange(interview.starts_at, interview.ends_at)}
                    </p>
                    {interview.location ? (
                      <p
                        className="mt-1 flex items-center gap-1 text-xs"
                        style={{ color: "rgba(255,255,255,0.55)" }}
                      >
                        <MapPin size={12} />
                        {interview.location}
                      </p>
                    ) : null}
                    {interview.meeting_url ? (
                      <a
                        className="mt-1 flex items-center gap-1 text-xs underline"
                        href={interview.meeting_url}
                        rel="noopener"
                        style={{ color: "#7dd3fc" }}
                        target="_blank"
                      >
                        <Video size={12} />
                        Join meeting
                      </a>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="rounded-full px-2 py-0.5 text-xs uppercase tracking-wide"
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        color: "rgba(255,255,255,0.5)",
                      }}
                    >
                      {interview.status}
                    </span>
                    {interview.status !== InterviewStatus.CANCELLED &&
                    interview.status !== InterviewStatus.COMPLETED ? (
                      <button
                        className="rounded-lg px-2 py-1 text-xs"
                        onClick={() => handleCancel(interview.$id)}
                        style={{
                          background: "rgba(239,68,68,0.10)",
                          border: "1px solid rgba(239,68,68,0.24)",
                          color: "#FCA5A5",
                        }}
                        type="button"
                      >
                        Cancel
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Users
                      size={12}
                      style={{ color: "rgba(255,255,255,0.4)" }}
                    />
                    <p
                      className="text-xs"
                      style={{ color: "rgba(255,255,255,0.45)" }}
                    >
                      Panel
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {candidate ? (
                      <span
                        className="rounded-full px-2.5 py-1 text-xs"
                        style={{
                          background: "rgba(168,139,250,0.10)",
                          color: "#C4B5FD",
                        }}
                      >
                        Candidate · {candidate.display_name ?? applicantName}
                      </span>
                    ) : (
                      <span
                        className="rounded-full px-2.5 py-1 text-xs"
                        style={{
                          background: "rgba(168,139,250,0.10)",
                          color: "#C4B5FD",
                        }}
                      >
                        Candidate · {applicantName} ({applicantEmail})
                      </span>
                    )}
                    {interviewerParticipants.map((participant) => (
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs"
                        key={participant.$id}
                        style={{
                          background: "rgba(61,169,224,0.10)",
                          color: "#7dd3fc",
                        }}
                      >
                        {participant.display_name ?? participant.email}
                        {participant.is_lead ? " (lead)" : ""}
                        <button
                          aria-label="Remove participant"
                          className="opacity-60 hover:opacity-100"
                          onClick={() =>
                            handleRemoveParticipant(
                              interview.$id,
                              participant.$id
                            )
                          }
                          type="button"
                        >
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                    <select
                      className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-white text-xs outline-none"
                      onChange={(event) => {
                        const value = event.target.value;
                        if (value) {
                          handleAddParticipant(interview.$id, value);
                          event.target.value = "";
                        }
                      }}
                      value=""
                    >
                      <option value="">+ Add interviewer</option>
                      {reviewers
                        .filter(
                          (reviewer) =>
                            !interviewerParticipants.some(
                              (participant) =>
                                participant.user_id === reviewer.id
                            )
                        )
                        .map((reviewer) => (
                          <option key={reviewer.id} value={reviewer.id}>
                            {reviewer.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-2 text-xs">
                    <span style={{ color: "rgba(255,255,255,0.45)" }}>
                      Reschedule (starts)
                    </span>
                    <input
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
                      onChange={(event) =>
                        handleUpdateField(interview.$id, {
                          starts_at: new Date(event.target.value).toISOString(),
                        })
                      }
                      type="datetime-local"
                      value={toDateTimeInputValue(interview.starts_at)}
                    />
                  </label>
                  <label className="space-y-2 text-xs">
                    <span style={{ color: "rgba(255,255,255,0.45)" }}>
                      Status
                    </span>
                    <select
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
                      onChange={(event) =>
                        handleUpdateField(interview.$id, {
                          status: event.target.value as InterviewStatus,
                        })
                      }
                      value={interview.status}
                    >
                      <option value="proposed">Proposed</option>
                      <option value="scheduled">Scheduled</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                      <option value="no_show">No-show</option>
                    </select>
                  </label>
                </div>

                {sCards.length > 0 ? (
                  <div className="space-y-2">
                    <p
                      className="text-xs uppercase tracking-[0.2em]"
                      style={{ color: "rgba(255,255,255,0.30)" }}
                    >
                      Panel scorecards
                    </p>
                    <div className="grid gap-2 md:grid-cols-2">
                      {sCards.map((entry) => (
                        <div
                          className="rounded-xl p-3 text-xs"
                          key={entry.scorecard.$id}
                          style={{
                            background: "rgba(255,255,255,0.02)",
                            border: "1px solid rgba(255,255,255,0.05)",
                          }}
                        >
                          <p
                            className="font-medium text-xs"
                            style={{ color: "#fff" }}
                          >
                            {entry.scorecard.recommendation ?? "—"}
                            {" · "}
                            {entry.scorecard.overall_score ?? "—"} / 5
                          </p>
                          <p
                            className="mt-1 text-xs"
                            style={{ color: "rgba(255,255,255,0.5)" }}
                          >
                            {entry.scorecard.strengths ?? "No strengths noted"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {userIsParticipant ? (
                  <JobInterviewScorecardForm
                    existing={userScorecard?.scorecard ?? null}
                    existingCriteria={userScorecard?.criteria ?? []}
                    interviewId={interview.$id}
                    onSubmitted={(scorecard) => {
                      handleScorecardSubmitted(
                        interview.$id,
                        scorecard,
                        userScorecard?.criteria ?? []
                      );
                    }}
                  />
                ) : (
                  <p
                    className="text-xs"
                    style={{ color: "rgba(255,255,255,0.35)" }}
                  >
                    You aren’t on this panel. Only panelists can submit a
                    scorecard.
                  </p>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}
