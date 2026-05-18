import type { ReactNode } from "react";
import { STUDIO } from "./studio";

interface PreviewPanelProps {
  children: ReactNode;
  title?: string;
}

export function PreviewPanel({
  title = "Live Preview",
  children,
}: PreviewPanelProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span
          className="font-mono text-[11px] uppercase tracking-widest"
          style={{ color: STUDIO.ink4 }}
        >
          {title}
        </span>
        <div className="h-px flex-1" style={{ background: STUDIO.rule }} />
      </div>
      <div className="w-full">{children}</div>
    </div>
  );
}
