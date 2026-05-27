"use client";

import type { JobInterviewScorecards } from "@repo/api/types/appwrite";
import type {
  RecruitmentRecommendation,
  RecruitmentScorecardCriterion,
  RecruitmentScorecardSubmitInput,
} from "@repo/shared/types/recruitment";
import { Star } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { submitScorecard } from "../../_actions/interviews";
import { STUDIO } from "../../_components/studio";

interface Props {
  defaultCriteria?: { key: string; label: string }[];
  existing?: JobInterviewScorecards | null;
  existingCriteria?: RecruitmentScorecardCriterion[];
  interviewId: string;
  onSubmitted?: (scorecard: JobInterviewScorecards) => void;
}

const RECOMMENDATIONS: { value: RecruitmentRecommendation; label: string }[] = [
  { label: "Strong hire", value: "strong_hire" },
  { label: "Hire", value: "hire" },
  { label: "Need more info", value: "need_more_info" },
  { label: "No hire", value: "no_hire" },
  { label: "Strong no hire", value: "strong_no_hire" },
];

const DEFAULT_CRITERIA: { key: string; label: string }[] = [
  { key: "technical", label: "Skills / domain knowledge" },
  { key: "communication", label: "Communication" },
  { key: "ownership", label: "Ownership & initiative" },
  { key: "fit", label: "BISO culture fit" },
];

export function JobInterviewScorecardForm({
  interviewId,
  existing,
  existingCriteria,
  defaultCriteria = DEFAULT_CRITERIA,
  onSubmitted,
}: Props) {
  const initialCriteria: RecruitmentScorecardCriterion[] =
    existingCriteria && existingCriteria.length > 0
      ? existingCriteria
      : defaultCriteria.map((entry) => ({
          comment: null,
          key: entry.key,
          label: entry.label,
          score: null,
        }));

  const [criteria, setCriteria] =
    useState<RecruitmentScorecardCriterion[]>(initialCriteria);
  const [overall, setOverall] = useState<number>(existing?.overall_score ?? 3);
  const [recommendation, setRecommendation] =
    useState<RecruitmentRecommendation>(
      (existing?.recommendation as RecruitmentRecommendation) ?? "hire"
    );
  const [strengths, setStrengths] = useState(existing?.strengths ?? "");
  const [concerns, setConcerns] = useState(existing?.concerns ?? "");
  const [privateNotes, setPrivateNotes] = useState(
    existing?.private_notes ?? ""
  );
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (existing) {
      setOverall(existing.overall_score ?? 3);
      setRecommendation(
        (existing.recommendation as RecruitmentRecommendation) ?? "hire"
      );
      setStrengths(existing.strengths ?? "");
      setConcerns(existing.concerns ?? "");
      setPrivateNotes(existing.private_notes ?? "");
    }
  }, [existing]);

  function patchCriterion(
    index: number,
    patch: Partial<RecruitmentScorecardCriterion>
  ) {
    setCriteria((existingCriteriaList) =>
      existingCriteriaList.map((entry, currentIndex) =>
        currentIndex === index ? { ...entry, ...patch } : entry
      )
    );
  }

  function handleSubmit() {
    const payload: RecruitmentScorecardSubmitInput = {
      concerns: concerns.trim() ? concerns.trim() : null,
      criteria,
      interview_id: interviewId,
      overall_score: overall,
      private_notes: privateNotes.trim() ? privateNotes.trim() : null,
      recommendation,
      strengths: strengths.trim() ? strengths.trim() : null,
    };

    startTransition(async () => {
      const result = await submitScorecard(payload);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.data) {
        toast.success("Scorecard saved");
        onSubmitted?.(result.data);
      }
    });
  }

  const inputStyle = {
    background: STUDIO.paper,
    border: `1px solid ${STUDIO.rule}`,
    color: STUDIO.ink,
  };

  return (
    <div
      className="space-y-4 rounded-2xl p-4"
      style={{
        background: STUDIO.paper2,
        border: `1px solid ${STUDIO.rule}`,
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Star size={16} style={{ color: STUDIO.gold }} />
          <p className="font-medium text-sm" style={{ color: STUDIO.ink }}>
            My scorecard
          </p>
        </div>
        {existing?.submitted_at ? (
          <span className="text-xs" style={{ color: STUDIO.ink4 }}>
            Last saved {new Date(existing.submitted_at).toLocaleString()}
          </span>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {criteria.map((criterion, index) => (
          <label className="space-y-2 text-xs" key={criterion.key}>
            <span style={{ color: STUDIO.ink3 }}>{criterion.label}</span>
            <div className="flex items-center gap-2">
              <select
                className="w-24 rounded-xl px-3 py-2 text-sm outline-none"
                onChange={(event) =>
                  patchCriterion(index, {
                    score: event.target.value
                      ? Number(event.target.value)
                      : null,
                  })
                }
                style={inputStyle}
                value={criterion.score ?? ""}
              >
                <option value="">—</option>
                {[1, 2, 3, 4, 5].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              <input
                className="flex-1 rounded-xl px-3 py-2 text-xs outline-none"
                onChange={(event) =>
                  patchCriterion(index, {
                    comment: event.target.value || null,
                  })
                }
                placeholder="Brief comment"
                style={inputStyle}
                value={criterion.comment ?? ""}
              />
            </div>
          </label>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-2 text-xs">
          <span style={{ color: STUDIO.ink3 }}>Overall score</span>
          <select
            className="w-full rounded-xl px-3 py-2 text-sm outline-none"
            onChange={(event) => setOverall(Number(event.target.value))}
            style={inputStyle}
            value={overall}
          >
            {[1, 2, 3, 4, 5].map((value) => (
              <option key={value} value={value}>
                {value} / 5
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-xs">
          <span style={{ color: STUDIO.ink3 }}>Recommendation</span>
          <select
            className="w-full rounded-xl px-3 py-2 text-sm outline-none"
            onChange={(event) =>
              setRecommendation(event.target.value as RecruitmentRecommendation)
            }
            style={inputStyle}
            value={recommendation}
          >
            {RECOMMENDATIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block space-y-2 text-xs">
        <span style={{ color: STUDIO.ink3 }}>Strengths</span>
        <textarea
          className="min-h-16 w-full rounded-xl px-3 py-2 text-sm outline-none"
          onChange={(event) => setStrengths(event.target.value)}
          placeholder="What stood out?"
          style={inputStyle}
          value={strengths}
        />
      </label>

      <label className="block space-y-2 text-xs">
        <span style={{ color: STUDIO.ink3 }}>Concerns</span>
        <textarea
          className="min-h-16 w-full rounded-xl px-3 py-2 text-sm outline-none"
          onChange={(event) => setConcerns(event.target.value)}
          placeholder="Anything that gave you pause?"
          style={inputStyle}
          value={concerns}
        />
      </label>

      <label className="block space-y-2 text-xs">
        <span style={{ color: STUDIO.ink3 }}>Private notes</span>
        <textarea
          className="min-h-16 w-full rounded-xl px-3 py-2 text-sm outline-none"
          onChange={(event) => setPrivateNotes(event.target.value)}
          placeholder="Visible only to you and the HR lead."
          style={inputStyle}
          value={privateNotes}
        />
      </label>

      <button
        className="w-full rounded-xl px-4 py-3 font-medium text-sm transition-all"
        disabled={isPending}
        onClick={handleSubmit}
        style={{
          background: STUDIO.ink,
          color: STUDIO.paper,
          opacity: isPending ? 0.65 : 1,
        }}
        type="button"
      >
        {isPending ? "Saving..." : "Save scorecard"}
      </button>
    </div>
  );
}
