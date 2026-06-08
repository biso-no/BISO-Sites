"use client";

import { avatarGradient, initials, matchTint } from "./view-model";

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        alignItems: "center",
        background: avatarGradient(name),
        borderRadius: "50%",
        color: "#fff",
        display: "inline-flex",
        flexShrink: 0,
        fontFamily: "var(--serif)",
        fontSize: size * 0.38,
        fontWeight: 500,
        height: size,
        justifyContent: "center",
        letterSpacing: 0,
        lineHeight: 1,
        width: size,
      }}
    >
      {initials(name)}
    </span>
  );
}

export function MatchRing({
  score,
  size = 38,
}: {
  score: number | null;
  size?: number;
}) {
  const tint = matchTint(score);
  const radius = (size - 5) / 2;
  const circ = 2 * Math.PI * radius;
  const pct = score == null ? 0 : Math.min(100, Math.max(0, score));
  const dash = (pct / 100) * circ;

  return (
    <span
      style={{
        alignItems: "center",
        display: "inline-flex",
        height: size,
        justifyContent: "center",
        position: "relative",
        width: size,
      }}
      title={score == null ? "Not screened" : `${score}% match`}
    >
      <svg height={size} width={size}>
        <title>{score == null ? "Not screened" : `${score}% match`}</title>
        <circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          stroke="rgba(26,24,20,0.1)"
          strokeWidth={2.5}
        />
        {score == null ? null : (
          <circle
            cx={size / 2}
            cy={size / 2}
            fill="none"
            r={radius}
            stroke={tint}
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            strokeWidth={2.5}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </svg>
      <span
        style={{
          color: tint,
          fontFamily: "var(--serif)",
          fontSize: size * 0.3,
          fontWeight: 500,
          position: "absolute",
        }}
      >
        {score == null ? "—" : score}
      </span>
    </span>
  );
}
