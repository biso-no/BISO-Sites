import type { ReactNode } from "react";

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
          style={{ color: "rgba(255,255,255,0.30)" }}
        >
          {title}
        </span>
        <div
          className="h-px flex-1"
          style={{ background: "rgba(255,255,255,0.06)" }}
        />
      </div>
      <div className="w-full">{children}</div>
    </div>
  );
}
