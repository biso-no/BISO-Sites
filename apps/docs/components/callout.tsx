import { cn } from "@repo/ui/lib/utils";
import type { ReactNode } from "react";

type CalloutType = "info" | "warn" | "error";

interface CalloutProps {
  children: ReactNode;
  title?: string;
  /**
   * `info`, `warn` or `error`. The older names `warning` and `danger` still
   * work, so pages moved over from legacy/ render unchanged.
   */
  type?: CalloutType | "warning" | "danger";
}

const ALIASES: Record<string, CalloutType> = {
  warning: "warn",
  danger: "error",
};

/** A left rule marks the kind; there is no icon. */
const calloutStyles: Record<CalloutType, string> = {
  info: "border-action bg-panel",
  warn: "border-sun bg-notice",
  error: "border-danger bg-panel",
};

function isCalloutType(value: string): value is CalloutType {
  return Object.hasOwn(calloutStyles, value);
}

/** Unknown types fall back to `info` rather than rendering unstyled. */
function calloutType(type: string): CalloutType {
  const resolved = ALIASES[type] ?? type;
  return isCalloutType(resolved) ? resolved : "info";
}

export function Callout({ type = "info", title, children }: CalloutProps) {
  return (
    <div
      className={cn(
        "my-6 border-l-[3px] px-4 py-3 text-sm",
        calloutStyles[calloutType(type)]
      )}
    >
      {title && <p className="mt-0 mb-1 font-bold">{title}</p>}
      <div className="[&>p:first-child]:mt-0 [&>p:last-child]:mb-0 [&>p]:my-2">
        {children}
      </div>
    </div>
  );
}
