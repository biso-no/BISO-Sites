"use client";

import { ArrowRight, CalendarPlus, GitCompare } from "lucide-react";
import { useRecruitment } from "../recruitment-context";
import { Avatar, MatchRing } from "../shared";
import { cx, sourceMeta, type WorkspaceCandidate } from "../view-model";

export function CandidateCard({
  candidate,
  selected,
  onToggleSelect,
  onDragStart,
}: {
  candidate: WorkspaceCandidate;
  onDragStart: (id: string) => void;
  onToggleSelect: (id: string) => void;
  selected: boolean;
}) {
  const { actions, addToCompare } = useRecruitment();
  const source = sourceMeta(candidate.source);
  const highMatch = (candidate.score ?? 0) >= 90;
  const extraSkills = Math.max(0, candidate.skills.length - 3);

  return (
    // biome-ignore lint/a11y/useSemanticElements: card holds nested action buttons, so it cannot be a <button>
    <div
      className={cx(
        "cand-card",
        candidate.starred && "starred",
        highMatch && "high",
        selected && "selected"
      )}
      draggable
      onClick={() => actions.openCandidate(candidate.id)}
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", candidate.id);
        event.dataTransfer.effectAllowed = "move";
        onDragStart(candidate.id);
      }}
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
        checked={selected}
        className="cc-check"
        onChange={() => onToggleSelect(candidate.id)}
        onClick={(event) => event.stopPropagation()}
        type="checkbox"
      />
      <div className="cc-top">
        <Avatar name={candidate.name} size={34} />
        <div className="cc-id">
          <div className="cc-name">
            {candidate.name}
            {candidate.starred ? <span className="cc-star">★</span> : null}
          </div>
          {candidate.year || candidate.currentRole ? (
            <div className="cc-year">
              {candidate.year ?? candidate.currentRole}
            </div>
          ) : null}
        </div>
        <MatchRing score={candidate.score} size={38} />
      </div>

      {candidate.summary ? (
        <p className="cc-summary">
          <span>AI</span> {candidate.summary}
        </p>
      ) : null}

      {candidate.skills.length > 0 ? (
        <div className="cc-skills">
          {candidate.skills.slice(0, 3).map((skill) => (
            <span className="cc-skill" key={skill}>
              {skill}
            </span>
          ))}
          {extraSkills > 0 ? (
            <span className="cc-skill more">+{extraSkills}</span>
          ) : null}
        </div>
      ) : null}

      <div className="cc-foot">
        <span className="cc-src">
          <span className="cc-pin" style={{ background: source.tint }} />
          {source.label} · {candidate.days}d
        </span>
        <div className="cc-actions">
          <button
            onClick={(event) => {
              event.stopPropagation();
              addToCompare(candidate.id);
            }}
            title="Add to compare"
            type="button"
          >
            <GitCompare size={13} />
          </button>
          <button
            onClick={(event) => {
              event.stopPropagation();
              actions.openSchedule(candidate);
            }}
            title="Schedule interview"
            type="button"
          >
            <CalendarPlus size={13} />
          </button>
          <button
            onClick={(event) => {
              event.stopPropagation();
              actions.openAdvance(candidate);
            }}
            title="Advance stage"
            type="button"
          >
            <ArrowRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
