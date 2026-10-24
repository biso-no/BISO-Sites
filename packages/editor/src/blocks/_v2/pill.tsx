import type { ReactNode } from "react";

export type PillTone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "marker";

/** Same tones as the web `ui/pill`: a brand colour over a tint of itself. */
const TONE: Record<PillTone, string> = {
  neutral: "bg-ink-muted/8 text-ink-muted",
  accent: "bg-action/10 text-ink-accent",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
  marker: "bg-marker/30 text-ink",
};

export function Pill({
  children,
  tone = "neutral",
  uppercase = false,
}: {
  children: ReactNode;
  tone?: PillTone;
  uppercase?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-biso-pill px-2.5 py-1 ${
        uppercase ? "type-label" : "type-body-sm font-semibold"
      } ${TONE[tone] ?? TONE.neutral}`}
    >
      {children}
    </span>
  );
}
