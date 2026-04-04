import { cn } from "@/lib/utils";

type CharacterCountProps = {
  current: number;
  max: number;
  className?: string;
};

export function CharacterCount({ current, max, className }: CharacterCountProps) {
  const pct = max > 0 ? current / max : 0;
  const isWarning = pct >= 0.8 && pct < 0.95;
  const isDanger = pct >= 0.95;

  return (
    <span
      className={cn(
        "tabular-nums text-xs transition-colors",
        isWarning && "text-amber-500",
        isDanger && "font-medium text-destructive",
        !isWarning && !isDanger && "text-muted-foreground",
        className,
      )}
      aria-live="polite"
    >
      {current.toLocaleString()}/{max.toLocaleString()}
    </span>
  );
}
