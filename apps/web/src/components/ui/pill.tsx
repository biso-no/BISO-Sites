import { cn } from "@repo/ui/lib/utils";
import type { ReactNode } from "react";

/**
 * The small status/category/campus label used throughout the reference design —
 * "Register", "Info only", "STAFF FUNCTION", "Oslo". Replaces roughly 40 inline
 * badge spans, each of which picked its own colours.
 *
 * Every variant is a brand colour over a 10% tint of itself. That is the shape
 * a pill actually takes, and it is the case that caught `--biso-success`: the
 * spec's original green was 5.02:1 on paper but only 4.39:1 on its own tint.
 * The token was darkened rather than the pill special-cased.
 */
export type PillTone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "marker";

const TONE: Record<PillTone, string> = {
  neutral: "bg-ink-muted/8 text-ink-muted",
  accent: "bg-action/10 text-ink-accent",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
  marker: "bg-marker/30 text-ink",
};

export interface PillProps {
  children: ReactNode;
  className?: string;
  tone?: PillTone;
  /** Uppercase micro-label, as the reference uses for job categories. */
  uppercase?: boolean;
}

export function Pill({
  children,
  tone = "neutral",
  uppercase = false,
  className,
}: PillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-biso-pill px-2.5 py-1",
        uppercase ? "type-label" : "type-body-sm font-medium",
        TONE[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
