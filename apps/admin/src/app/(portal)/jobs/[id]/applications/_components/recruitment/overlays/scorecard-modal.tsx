"use client";

import type { RecruitmentRecommendation } from "@repo/shared/types/recruitment";
import { ClipboardCheck, Star } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { submitScorecard } from "@/app/(portal)/_actions/interviews";
import {
  type CandidateDetail,
  getCandidateDetail,
} from "../../../_actions/recruitment-workspace";
import { cx, type WorkspaceCandidate } from "../view-model";
import { ModalShell } from "./modal-shell";

const CRITERIA = [
  {
    key: "communication",
    label: "Communication",
    desc: "Clarity, listening, written tone.",
  },
  {
    key: "skills",
    label: "Relevant skills",
    desc: "Stack matches the rubric.",
  },
  {
    key: "culture",
    label: "Culture add",
    desc: "Brings something the team lacks.",
  },
  {
    key: "initiative",
    label: "Initiative",
    desc: "Self-starts on ambiguous work.",
  },
  {
    key: "problemSolving",
    label: "Problem-solving",
    desc: "Reasons through new scenarios.",
  },
];

const RECS: { id: RecruitmentRecommendation; label: string; cls: string }[] = [
  { cls: "strong", id: "strong_hire", label: "Strong hire" },
  { cls: "hire", id: "hire", label: "Hire" },
  { cls: "", id: "need_more_info", label: "Need more info" },
  { cls: "nohire", id: "no_hire", label: "No hire" },
  { cls: "nohire", id: "strong_no_hire", label: "Strong no-hire" },
];

export function ScorecardModal({
  candidate,
  round,
  onClose,
}: {
  candidate: WorkspaceCandidate;
  onClose: () => void;
  round: number;
}) {
  const [detail, setDetail] = useState<CandidateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [strengths, setStrengths] = useState("");
  const [concerns, setConcerns] = useState("");
  const [recommendation, setRecommendation] =
    useState<RecruitmentRecommendation | null>(null);
  const [submitting, startSubmit] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getCandidateDetail(candidate.id)
      .then((result) => active && setDetail(result))
      .catch(
        () =>
          active && setDetail({ answers: [], interviews: [], scorecards: [] })
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [candidate.id]);

  const interview =
    detail?.interviews.find((entry) => entry.round === round) ??
    detail?.interviews.at(-1) ??
    null;

  const scoredValues = Object.values(scores);
  const overall =
    scoredValues.length > 0
      ? Math.round(
          scoredValues.reduce((sum, value) => sum + value, 0) /
            scoredValues.length
        )
      : 0;

  const submit = () => {
    if (!(interview && recommendation && overall > 0)) {
      return;
    }
    setError(null);
    startSubmit(async () => {
      const result = await submitScorecard({
        concerns: concerns || null,
        criteria: CRITERIA.map((criterion) => ({
          comment: null,
          key: criterion.key,
          label: criterion.label,
          score: scores[criterion.key] ?? null,
        })),
        interview_id: interview.id,
        overall_score: overall,
        private_notes: null,
        recommendation,
        strengths: strengths || null,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      onClose();
    });
  };

  return (
    <ModalShell
      eyebrow={`Scorecard · ${candidate.name}`}
      footer={
        <>
          <span className="m-foot-note">
            {overall > 0 ? `Overall ${overall}/5 · ` : ""}Private to the panel
          </span>
          <div className="m-foot-actions">
            <button className="btn-ghost" onClick={onClose} type="button">
              Cancel
            </button>
            <button
              className="btn-dark"
              disabled={
                !(interview && recommendation && overall > 0) || submitting
              }
              onClick={submit}
              type="button"
            >
              {submitting ? "Submitting…" : "Submit scorecard"}
            </button>
          </div>
        </>
      }
      icon={<ClipboardCheck size={16} />}
      onClose={onClose}
      title={`Scorecard — Round ${round}`}
    >
      {loading ? <p className="sc-loading">Loading interview…</p> : null}
      {!loading && interview ? (
        <>
          <div className="sc-crits">
            {CRITERIA.map((criterion) => (
              <div className="sc-crit" key={criterion.key}>
                <div className="sc-crit-id">
                  <span className="sc-crit-label">{criterion.label}</span>
                  <span className="sc-crit-desc">{criterion.desc}</span>
                </div>
                <div className="sc-stars">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      className={cx(
                        "sc-star",
                        (scores[criterion.key] ?? 0) >= value && "on"
                      )}
                      key={value}
                      onClick={() =>
                        setScores((prev) => ({
                          ...prev,
                          [criterion.key]: value,
                        }))
                      }
                      type="button"
                    >
                      <Star
                        fill={
                          (scores[criterion.key] ?? 0) >= value
                            ? "currentColor"
                            : "none"
                        }
                        size={16}
                      />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="sc-texts">
            <label className="sc-text">
              <span>Strengths</span>
              <textarea
                onChange={(event) => setStrengths(event.target.value)}
                placeholder="What stood out?"
                value={strengths}
              />
            </label>
            <label className="sc-text">
              <span>Open questions / concerns</span>
              <textarea
                onChange={(event) => setConcerns(event.target.value)}
                placeholder="What would you want to probe further?"
                value={concerns}
              />
            </label>
          </div>

          <div className="sc-recs">
            {RECS.map((rec) => (
              <button
                className={cx(
                  "sc-rec",
                  rec.cls,
                  recommendation === rec.id && "on"
                )}
                key={rec.id}
                onClick={() => setRecommendation(rec.id)}
                type="button"
              >
                {rec.label}
              </button>
            ))}
          </div>

          {error ? <p className="sched-error">{error}</p> : null}
        </>
      ) : null}
      {loading || interview ? null : (
        <p className="sc-loading">
          No interview found for {candidate.name} in round {round}. Schedule an
          interview before adding a scorecard.
        </p>
      )}
    </ModalShell>
  );
}
