"use client";

import { CheckCircle2, Clock, Flag, Sparkles, Target } from "lucide-react";
import type { ReactNode } from "react";
import { useRecruitment } from "../recruitment-context";
import { sourceMeta } from "../view-model";

interface Insight {
  action?: { label: string; run: () => void };
  icon: ReactNode;
  kind: "match" | "stall" | "gap" | "balance";
  text: string;
}

export function AiInsights() {
  const { candidates, actions } = useRecruitment();

  const strong = candidates
    .filter((c) => (c.score ?? 0) >= 90)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const stalling = candidates.filter(
    (c) => c.stage === "interview" && c.days >= 6 && !c.scorecard
  );

  const sourceCounts = new Map<string, number>();
  for (const candidate of candidates) {
    const meta = sourceMeta(candidate.source);
    sourceCounts.set(meta.label, (sourceCounts.get(meta.label) ?? 0) + 1);
  }
  const topSource = Array.from(sourceCounts.entries()).sort(
    (a, b) => b[1] - a[1]
  )[0];
  const topSharePct =
    topSource && candidates.length > 0
      ? Math.round((topSource[1] / candidates.length) * 100)
      : 0;

  const insights: Insight[] = [];
  if (strong.length > 0) {
    insights.push({
      action:
        strong.length >= 2
          ? {
              label: "Compare top",
              run: () =>
                actions.openCompare(strong.slice(0, 3).map((c) => c.id)),
            }
          : undefined,
      icon: <Target size={14} />,
      kind: "match",
      text: `${strong.length} strong ${strong.length === 1 ? "match" : "matches"} above 90% — ${strong
        .slice(0, 2)
        .map((c) => c.name.split(" ")[0])
        .join(" and ")} lead.`,
    });
  }
  if (stalling.length > 0) {
    insights.push({
      action: {
        label: "Nudge panel",
        run: () =>
          actions.openEmail(
            stalling.map((c) => c.id),
            "schedule"
          ),
      },
      icon: <Clock size={14} />,
      kind: "stall",
      text: `${stalling.length} ${stalling.length === 1 ? "candidate is" : "candidates are"} stalling in Interview with no scorecard yet.`,
    });
  }
  const unscored = candidates.filter((c) => c.score == null).length;
  if (unscored > 0) {
    insights.push({
      icon: <Flag size={14} />,
      kind: "gap",
      text: `${unscored} ${unscored === 1 ? "application has" : "applications have"} no AI screening yet.`,
    });
  }
  if (topSource) {
    insights.push({
      icon: <CheckCircle2 size={14} />,
      kind: "balance",
      text: `Source mix is ${topSharePct}% ${topSource[0]} — diversify sourcing for the next round.`,
    });
  }

  if (insights.length === 0) {
    return null;
  }

  return (
    <div className="ai-insights">
      <div className="aii-head">
        <span className="aii-title">
          <Sparkles size={13} /> AI noticed {insights.length}{" "}
          {insights.length === 1 ? "thing" : "things"}
        </span>
        <span className="aii-ver">Updated just now · v4.2</span>
      </div>
      <div className="aii-rows">
        {insights.map((insight) => (
          <div className={`aii-row ${insight.kind}`} key={insight.kind}>
            <span className="aii-ico">{insight.icon}</span>
            <span className="aii-text">{insight.text}</span>
            {insight.action ? (
              <button
                className="aii-act"
                onClick={insight.action.run}
                type="button"
              >
                {insight.action.label} →
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
