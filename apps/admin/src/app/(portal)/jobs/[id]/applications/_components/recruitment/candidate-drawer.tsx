"use client";

import {
  ArrowRight,
  CalendarPlus,
  CheckCircle2,
  ExternalLink,
  FileText,
  GitCompare,
  Linkedin,
  Mail,
  Star,
  X,
} from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { updateJobApplicationReview } from "@/app/(portal)/_actions/jobs";
import {
  type CandidateDetail,
  getCandidateDetail,
  setCandidateStarred,
} from "../../_actions/recruitment-workspace";
import { useRecruitment } from "./recruitment-context";
import { Avatar } from "./shared";
import {
  cx,
  formatShortDate,
  matchTint,
  STAGE_OF_STATUS,
  stageMeta,
  type WorkspaceCandidate,
} from "./view-model";

type DrawerTab = "overview" | "resume" | "answers" | "interviews" | "notes";

const REC_LABEL: Record<string, string> = {
  hire: "Hire",
  need_more_info: "Need more info",
  no_hire: "No hire",
  strong_hire: "Strong hire",
  strong_no_hire: "Strong no-hire",
};

export function CandidateDrawer({
  candidate,
  onClose,
}: {
  candidate: WorkspaceCandidate;
  onClose: () => void;
}) {
  const { actions, addToCompare, updateCandidate } = useRecruitment();
  const [tab, setTab] = useState<DrawerTab>("overview");
  const [detail, setDetail] = useState<CandidateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState(candidate.reviewNotes ?? "");
  const [savingNote, startSaveNote] = useTransition();
  const [, startStar] = useTransition();
  const stage = stageMeta(STAGE_OF_STATUS[candidate.stage] ?? "submitted");

  useEffect(() => {
    let active = true;
    setLoading(true);
    getCandidateDetail(candidate.id)
      .then((result) => {
        if (active) {
          setDetail(result);
        }
      })
      .catch(() => {
        if (active) {
          setDetail({ answers: [], interviews: [], scorecards: [] });
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [candidate.id]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggleStar = () => {
    const next = !candidate.starred;
    updateCandidate(candidate.id, { starred: next });
    startStar(async () => {
      await setCandidateStarred(candidate.id, next);
    });
  };

  const saveNotes = () => {
    updateCandidate(candidate.id, { reviewNotes: notes });
    startSaveNote(async () => {
      await updateJobApplicationReview(candidate.id, { review_notes: notes });
    });
  };

  const tabs: { id: DrawerTab; label: string; count?: number }[] = [
    { id: "overview", label: "Overview" },
    {
      count: candidate.resumeFileId ? undefined : 0,
      id: "resume",
      label: "Resume",
    },
    { count: detail?.answers.length, id: "answers", label: "Answers" },
    { count: detail?.interviews.length, id: "interviews", label: "Interviews" },
    { id: "notes", label: "Notes" },
  ];

  return (
    <>
      <button
        aria-label="Close"
        className="drawer-overlay"
        onClick={onClose}
        type="button"
      />
      <aside className="drawer" role="dialog">
        <div className="dr-head">
          <Avatar name={candidate.name} size={56} />
          <div className="dr-id">
            <div className="dr-eyebrow">
              <span
                className="dr-stage-dot"
                style={{ background: stage.tint }}
              />
              {stage.label}
              {candidate.currentRole ? ` · ${candidate.currentRole}` : ""}
            </div>
            <h2>
              {candidate.name}
              <button
                className={cx("dr-star", candidate.starred && "on")}
                onClick={toggleStar}
                title="Star candidate"
                type="button"
              >
                <Star size={16} />
              </button>
            </h2>
            <div className="dr-meta">
              <a href={`mailto:${candidate.email}`}>
                <Mail size={12} /> {candidate.email}
              </a>
              {candidate.linkedin ? (
                <a
                  href={
                    candidate.linkedin.startsWith("http")
                      ? candidate.linkedin
                      : `https://linkedin.com/in/${candidate.linkedin}`
                  }
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <Linkedin size={12} /> LinkedIn
                </a>
              ) : null}
              {candidate.phone ? <span>{candidate.phone}</span> : null}
            </div>
          </div>
          <div className="dr-actions">
            <button
              className="btn-ghost"
              onClick={() => addToCompare(candidate.id)}
              type="button"
            >
              <GitCompare size={13} /> Compare
            </button>
            <button
              className="btn-ghost"
              onClick={() => actions.openSchedule(candidate)}
              type="button"
            >
              <CalendarPlus size={13} /> Schedule
            </button>
            <button
              className="btn-dark"
              onClick={() => actions.openAdvance(candidate)}
              type="button"
            >
              <ArrowRight size={13} /> Advance
            </button>
            <button
              className="dr-close"
              onClick={onClose}
              title="Close"
              type="button"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="dr-tabs">
          {tabs.map((entry) => (
            <button
              className={cx("dr-tab", tab === entry.id && "on")}
              key={entry.id}
              onClick={() => setTab(entry.id)}
              type="button"
            >
              {entry.label}
              {typeof entry.count === "number" ? (
                <span className="dr-tab-count">{entry.count}</span>
              ) : null}
            </button>
          ))}
        </div>

        <div className="dr-body scroll">
          <div className="dr-main">
            {tab === "overview" ? <OverviewTab candidate={candidate} /> : null}
            {tab === "resume" ? <ResumeTab candidate={candidate} /> : null}
            {tab === "answers" ? (
              <AnswersTab detail={detail} loading={loading} />
            ) : null}
            {tab === "interviews" ? (
              <InterviewsDetail
                candidate={candidate}
                detail={detail}
                loading={loading}
              />
            ) : null}
            {tab === "notes" ? (
              <div className="dr-notes">
                <textarea
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Add a private review note for the panel…"
                  value={notes}
                />
                <button
                  className="btn-dark"
                  disabled={savingNote}
                  onClick={saveNotes}
                  type="button"
                >
                  {savingNote ? "Saving…" : "Save note"}
                </button>
              </div>
            ) : null}
          </div>

          <div className="dr-side">
            <Timeline candidate={candidate} />
            <ScorecardsPanel detail={detail} />
          </div>
        </div>
      </aside>
    </>
  );
}

function OverviewTab({ candidate }: { candidate: WorkspaceCandidate }) {
  return (
    <>
      <div className="ai-summary">
        <div className="ais-score">
          <span
            className="ais-big"
            style={{ color: matchTint(candidate.score) }}
          >
            {candidate.score ?? "—"}
          </span>
          <span className="ais-lbl">Match</span>
        </div>
        <div className="ais-gist">
          <p>{candidate.summary ?? "No AI screening summary yet."}</p>
          <span className="ais-tag">Auto-generated · v4.2</span>
          {candidate.dimensions.length > 0 ? (
            <div className="ais-bars">
              {candidate.dimensions.map((dim) => (
                <div className="ais-bar" key={dim.name}>
                  <span className="ais-bar-lbl">{dim.name}</span>
                  <span className="ais-bar-track">
                    <span
                      className="ais-bar-fill"
                      style={{ width: `${(dim.score / 5) * 100}%` }}
                    />
                  </span>
                  <span className="ais-bar-val">{dim.score}/5</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {candidate.strengths.length > 0 || candidate.gaps.length > 0 ? (
        <div className="dr-sg">
          {candidate.strengths.length > 0 ? (
            <div>
              <h4>Strengths</h4>
              <ul className="dr-strengths">
                {candidate.strengths.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {candidate.gaps.length > 0 ? (
            <div>
              <h4>Gaps</h4>
              <ul className="dr-gaps">
                {candidate.gaps.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {candidate.coverLetter ? (
        <div className="dr-block">
          <h4>Cover letter</h4>
          <p className="dr-cover">{candidate.coverLetter}</p>
        </div>
      ) : null}
    </>
  );
}

function ResumeTab({ candidate }: { candidate: WorkspaceCandidate }) {
  if (!candidate.resumeFileId) {
    return <div className="dr-empty">No resume on file.</div>;
  }
  const url = `/api/recruitment/applications/${candidate.id}/resume`;
  return (
    <div className="dr-resume">
      <div className="dr-resume-bar">
        <FileText size={16} /> Resume on file
        <a className="btn-ghost" href={url} rel="noreferrer" target="_blank">
          <ExternalLink size={12} /> Open
        </a>
      </div>
      <iframe className="dr-resume-frame" src={url} title="Resume preview" />
    </div>
  );
}

function AnswersTab({
  detail,
  loading,
}: {
  detail: CandidateDetail | null;
  loading: boolean;
}) {
  if (loading) {
    return <div className="dr-empty">Loading answers…</div>;
  }
  if (!detail || detail.answers.length === 0) {
    return <div className="dr-empty">No custom answers submitted.</div>;
  }
  return (
    <div className="dr-answers">
      {detail.answers.map((answer) => (
        <div className="dr-answer" key={answer.questionId}>
          <p className="dr-q">{answer.questionLabel}</p>
          <p className="dr-a">{answer.answer ?? "—"}</p>
        </div>
      ))}
    </div>
  );
}

function InterviewsDetail({
  candidate,
  detail,
  loading,
}: {
  candidate: WorkspaceCandidate;
  detail: CandidateDetail | null;
  loading: boolean;
}) {
  const { actions } = useRecruitment();
  if (loading) {
    return <div className="dr-empty">Loading interviews…</div>;
  }
  if (!detail || detail.interviews.length === 0) {
    return (
      <div className="dr-empty">
        No interviews yet.{" "}
        <button
          className="dr-inline-link"
          onClick={() => actions.openSchedule(candidate)}
          type="button"
        >
          Schedule one →
        </button>
      </div>
    );
  }
  return (
    <div className="dr-interviews">
      {detail.interviews.map((interview) => (
        <div className="dr-interview" key={interview.id}>
          <div className="dr-interview-head">
            <strong>
              Round {interview.round} · {interview.title}
            </strong>
            <span className={`dr-int-status ${interview.status}`}>
              {interview.status}
            </span>
          </div>
          <p className="dr-int-meta">
            {formatShortDate(interview.startsAt)}
            {interview.location ? ` · ${interview.location}` : ""}
            {interview.teams ? " · Teams" : ""}
          </p>
          <div className="dr-int-panel">
            {interview.panel.map((member) => (
              <span key={`${interview.id}-${member.email}`}>
                {member.name} ({member.responseStatus})
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Timeline({ candidate }: { candidate: WorkspaceCandidate }) {
  const events: {
    label: string;
    sub: string;
    state: "past" | "active" | "future";
  }[] = [
    {
      label: `Applied via ${candidate.source ?? "biso.no"}`,
      state: "past",
      sub: `${formatShortDate(candidate.appliedAt)} · GDPR consent`,
    },
  ];
  if (candidate.score != null) {
    events.push({
      label: "AI screening complete",
      state: "past",
      sub: `${candidate.score}% match · model v4.2`,
    });
  }
  if (
    candidate.stage === "reviewed" ||
    candidate.stage === "interview" ||
    candidate.stage === "accepted"
  ) {
    events.push({
      label: "Moved to Shortlist",
      state: "past",
      sub: "By reviewer",
    });
  }
  if (candidate.interview) {
    events.push({
      label: `Interview · round ${candidate.interview.round}`,
      state: candidate.stage === "interview" ? "active" : "past",
      sub: `${candidate.interview.panel.length} on panel`,
    });
  }
  if (candidate.scorecard) {
    events.push({
      label: "Scorecard submitted",
      state: "past",
      sub: `${candidate.scorecard.count} reviewer(s)`,
    });
  } else if (candidate.stage === "interview") {
    events.push({
      label: "Awaiting scorecard",
      state: "future",
      sub: "Pending panel",
    });
  }
  if (candidate.stage === "accepted") {
    events.push({
      label: "Offer sent",
      state: "active",
      sub: "Awaiting signature",
    });
  }

  return (
    <div className="dr-card">
      <h4>Activity</h4>
      <div className="dr-timeline">
        {events.map((event) => (
          <div className={`dr-tl-item ${event.state}`} key={event.label}>
            <span className="dr-tl-dot" />
            <div>
              <p className="dr-tl-label">{event.label}</p>
              <p className="dr-tl-sub">{event.sub}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScorecardsPanel({ detail }: { detail: CandidateDetail | null }) {
  if (!detail || detail.scorecards.length === 0) {
    return (
      <div className="dr-card">
        <h4>Scorecards</h4>
        <p className="dr-empty-mini">No scorecards yet.</p>
      </div>
    );
  }
  return (
    <div className="dr-card">
      <h4>Scorecards</h4>
      <div className="dr-scorecards">
        {detail.scorecards.map((scorecard) => (
          <div className="dr-scorecard" key={scorecard.id}>
            <div className="dr-sc-head">
              <span className="dr-sc-overall">
                {scorecard.overall ?? "—"}/5
              </span>
              {scorecard.recommendation ? (
                <span className="dr-sc-rec">
                  {REC_LABEL[scorecard.recommendation] ??
                    scorecard.recommendation}
                </span>
              ) : null}
            </div>
            {scorecard.criteria.map((criterion) => (
              <div className="dr-sc-crit" key={criterion.key}>
                <span>{criterion.label}</span>
                <span className="dr-sc-stars">
                  {"★".repeat(criterion.score ?? 0)}
                  <span className="dim">
                    {"★".repeat(Math.max(0, 5 - (criterion.score ?? 0)))}
                  </span>
                </span>
              </div>
            ))}
            {scorecard.strengths ? (
              <p className="dr-sc-note">
                <CheckCircle2 size={11} /> {scorecard.strengths}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
