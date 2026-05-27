"use client";

import { ArrowRight, CalendarPlus } from "lucide-react";
import { useRecruitment } from "../recruitment-context";
import { Avatar } from "../shared";
import {
  matchTint,
  STAGE_OF_STATUS,
  sourceMeta,
  stageMeta,
  type WorkspaceCandidate,
} from "../view-model";

export function ListView({
  candidates,
  selectedIds,
  onToggleSelect,
  onToggleAll,
}: {
  candidates: WorkspaceCandidate[];
  onToggleAll: (checked: boolean) => void;
  onToggleSelect: (id: string) => void;
  selectedIds: Set<string>;
}) {
  const { actions } = useRecruitment();
  const allSelected =
    candidates.length > 0 && candidates.every((c) => selectedIds.has(c.id));

  return (
    <div className="list-view">
      <div className="lv-head">
        <input
          aria-label="Select all candidates"
          checked={allSelected}
          className="lv-check"
          onChange={(event) => onToggleAll(event.target.checked)}
          type="checkbox"
        />
        <span>Candidate</span>
        <span>Match</span>
        <span>Stage</span>
        <span>Skills</span>
        <span>Source</span>
        <span>Days</span>
        <span />
      </div>
      {candidates.map((candidate) => {
        const source = sourceMeta(candidate.source);
        const stage = stageMeta(
          STAGE_OF_STATUS[candidate.stage] ?? "submitted"
        );
        return (
          // biome-ignore lint/a11y/useSemanticElements: row holds nested controls, so it cannot be a <button>
          <div
            className="lv-row"
            key={candidate.id}
            onClick={() => actions.openCandidate(candidate.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                actions.openCandidate(candidate.id);
              }
            }}
            role="button"
            tabIndex={0}
          >
            <input
              aria-label={`Select ${candidate.name}`}
              checked={selectedIds.has(candidate.id)}
              className="lv-check"
              onChange={() => onToggleSelect(candidate.id)}
              onClick={(event) => event.stopPropagation()}
              type="checkbox"
            />
            <span className="lv-cand">
              <Avatar name={candidate.name} size={28} />
              <span className="lv-cand-id">
                <span className="lv-name">
                  {candidate.name}
                  {candidate.starred ? (
                    <span className="cc-star">★</span>
                  ) : null}
                </span>
                {candidate.year || candidate.currentRole ? (
                  <span className="lv-year">
                    {candidate.year ?? candidate.currentRole}
                  </span>
                ) : null}
              </span>
            </span>
            <span
              className="lv-match"
              style={{ color: matchTint(candidate.score) }}
            >
              {candidate.score == null ? "—" : `${candidate.score}%`}
            </span>
            <span className="lv-stage">
              <span className="lv-dot" style={{ background: stage.tint }} />
              {stage.label}
            </span>
            <span className="lv-skills">
              {candidate.skills.slice(0, 2).join(", ") || "—"}
            </span>
            <span className="lv-source">
              <span className="cc-pin" style={{ background: source.tint }} />
              {source.label}
            </span>
            <span className="lv-days mono">{candidate.days}d</span>
            <span className="lv-actions">
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  actions.openSchedule(candidate);
                }}
                title="Schedule"
                type="button"
              >
                <CalendarPlus size={13} />
              </button>
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  actions.openAdvance(candidate);
                }}
                title="Advance"
                type="button"
              >
                <ArrowRight size={13} />
              </button>
            </span>
          </div>
        );
      })}
      {candidates.length === 0 ? (
        <div className="lv-empty">No candidates match your filters.</div>
      ) : null}
    </div>
  );
}
