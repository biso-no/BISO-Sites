"use client";

import { ArrowRight, CalendarPlus, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  type AssistantCandidate,
  generateComparisonSynthesis,
} from "../../../_actions/recruitment-ai";
import { useRecruitment } from "../recruitment-context";
import { Avatar } from "../shared";
import {
  cx,
  matchTint,
  STAGE_OF_STATUS,
  sourceMeta,
  stageMeta,
  type WorkspaceCandidate,
} from "../view-model";

function toSummary(candidate: WorkspaceCandidate): AssistantCandidate {
  return {
    days: candidate.days,
    gaps: candidate.gaps,
    id: candidate.id,
    name: candidate.name,
    score: candidate.score,
    skills: candidate.skills,
    source: candidate.source,
    stage: candidate.stage,
    strengths: candidate.strengths,
    summary: candidate.summary,
  };
}

export function CompareView({
  ids,
  onClose,
}: {
  ids: string[];
  onClose: () => void;
}) {
  const { candidates, job, jobId, actions, removeFromCompare } =
    useRecruitment();
  const selected = useMemo(
    () =>
      ids
        .map((id) => candidates.find((candidate) => candidate.id === id))
        .filter((candidate): candidate is WorkspaceCandidate =>
          Boolean(candidate)
        ),
    [candidates, ids]
  );
  const [synthesis, setSynthesis] = useState<{
    verdict: string;
    winnerId: string | null;
  } | null>(null);

  useEffect(() => {
    let active = true;
    generateComparisonSynthesis(jobId, job.titleEn, selected.map(toSummary))
      .then((result) => active && setSynthesis(result))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [jobId, job.titleEn, selected]);

  const sharedSkills = useMemo(() => {
    if (selected.length === 0) {
      return new Set<string>();
    }
    const counts = new Map<string, number>();
    for (const candidate of selected) {
      for (const skill of new Set(candidate.skills)) {
        counts.set(skill, (counts.get(skill) ?? 0) + 1);
      }
    }
    return new Set(
      Array.from(counts.entries())
        .filter(([, count]) => count === selected.length)
        .map(([skill]) => skill)
    );
  }, [selected]);

  const rows: {
    label: string;
    render: (c: WorkspaceCandidate) => React.ReactNode;
  }[] = [
    {
      label: "Stage",
      render: (c) => stageMeta(STAGE_OF_STATUS[c.stage]).label,
    },
    {
      label: "Source",
      render: (c) => sourceMeta(c.source).label,
    },
    {
      label: "Skills",
      render: (c) => (
        <div className="cmp-skills">
          {c.skills.slice(0, 8).map((skill) => (
            <span
              className={cx(
                "cmp-skill",
                sharedSkills.has(skill) ? "shared" : "unique"
              )}
              key={skill}
            >
              {skill}
            </span>
          ))}
          {c.skills.length === 0 ? <span className="cmp-dash">—</span> : null}
        </div>
      ),
    },
    {
      label: "Strengths",
      render: (c) => (
        <ul className="cmp-list good">
          {c.strengths.slice(0, 4).map((item) => (
            <li key={item}>{item}</li>
          ))}
          {c.strengths.length === 0 ? <li className="cmp-dash">—</li> : null}
        </ul>
      ),
    },
    {
      label: "Gaps",
      render: (c) => (
        <ul className="cmp-list bad">
          {c.gaps.slice(0, 4).map((item) => (
            <li key={item}>{item}</li>
          ))}
          {c.gaps.length === 0 ? <li className="cmp-dash">—</li> : null}
        </ul>
      ),
    },
    {
      label: "Summary",
      render: (c) => <p className="cmp-summary">{c.summary ?? "—"}</p>,
    },
  ];

  return (
    <div className="cmp-overlay">
      <div className="cmp-head">
        <h2>Who fits {job.titleEn} best?</h2>
        <button className="btn-ghost" onClick={onClose} type="button">
          <X size={14} /> Back to pipeline
        </button>
      </div>

      <div className="cmp-body scroll">
        <div className="cmp-synth">
          <span className="cmp-synth-tag">
            <Sparkles size={13} /> AI synthesis · v4.2
          </span>
          <p>{synthesis ? synthesis.verdict : "Analysing candidates…"}</p>
        </div>

        <div
          className="cmp-cols"
          style={{
            gridTemplateColumns: `180px repeat(${selected.length}, minmax(220px, 1fr))`,
          }}
        >
          <div className="cmp-rail">
            <div className="cmp-rail-head" />
            <div className="cmp-rail-cell">Match</div>
            {rows.map((row) => (
              <div className="cmp-rail-cell" key={row.label}>
                {row.label}
              </div>
            ))}
            <div className="cmp-rail-cell" />
          </div>

          {selected.map((candidate) => {
            const isWinner = synthesis?.winnerId === candidate.id;
            return (
              <div
                className={cx("cmp-col", isWinner && "winner")}
                key={candidate.id}
              >
                <div className="cmp-col-head">
                  <Avatar name={candidate.name} size={40} />
                  <div>
                    <p className="cmp-col-name">{candidate.name}</p>
                    {candidate.currentRole ? (
                      <p className="cmp-col-role">{candidate.currentRole}</p>
                    ) : null}
                  </div>
                  <button
                    onClick={() => removeFromCompare(candidate.id)}
                    title="Remove"
                    type="button"
                  >
                    <X size={13} />
                  </button>
                </div>
                <div className="cmp-cell cmp-match">
                  <span style={{ color: matchTint(candidate.score) }}>
                    {candidate.score ?? "—"}
                  </span>
                  {isWinner ? <span className="cmp-pick">AI pick</span> : null}
                </div>
                {rows.map((row) => (
                  <div className="cmp-cell" key={row.label}>
                    {row.render(candidate)}
                  </div>
                ))}
                <div className="cmp-cell cmp-foot">
                  <button
                    className="btn-ghost"
                    onClick={() => actions.openSchedule(candidate)}
                    type="button"
                  >
                    <CalendarPlus size={12} /> Schedule
                  </button>
                  <button
                    className="btn-dark"
                    onClick={() => actions.openAdvance(candidate)}
                    type="button"
                  >
                    <ArrowRight size={12} /> Advance
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
