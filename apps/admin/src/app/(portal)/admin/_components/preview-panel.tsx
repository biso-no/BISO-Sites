import type { ReactNode } from "react";

type PreviewPanelProps = {
  title?: string;
  children: ReactNode;
};

export function PreviewPanel({
  title = "Live Preview",
  children,
}: PreviewPanelProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span
          className="text-[11px] uppercase tracking-widest font-mono"
          style={{ color: "rgba(255,255,255,0.30)" }}
        >
          {title}
        </span>
        <div
          className="flex-1 h-px"
          style={{ background: "rgba(255,255,255,0.06)" }}
        />
      </div>
      <div className="w-full">{children}</div>
    </div>
  );
}
