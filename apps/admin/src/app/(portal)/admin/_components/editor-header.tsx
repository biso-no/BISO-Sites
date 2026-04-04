import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { StatusBadge } from "./status-badge";

type EditorHeaderProps = {
  backHref: string;
  backLabel: string;
  title: string;
  status?: string;
  onDiscard?: () => void;
  discardLabel?: string;
  publishLabel?: string;
  saveDraftLabel?: string;
  children?: ReactNode;
  isSubmitting?: boolean;
};

export function EditorHeader({
  backHref,
  backLabel,
  title,
  status,
  discardLabel = "Discard",
  publishLabel = "Publish",
  saveDraftLabel,
  children,
  isSubmitting,
}: EditorHeaderProps) {
  return (
    <div
      className="sticky top-0 z-30 flex items-center gap-4 px-6 py-4 mb-8"
      style={{
        background: "rgba(0,10,22,0.85)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        marginLeft: "-3rem",
        marginRight: "-3rem",
      }}
    >
      <Link
        href={backHref}
        className="flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 transition-colors"
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.10)",
          color: "rgba(255,255,255,0.60)",
        }}
        aria-label={backLabel}
      >
        <ArrowLeft size={15} />
      </Link>

      <div className="flex-1 min-w-0 flex items-center gap-3">
        <h1
          className="text-base font-medium truncate"
          style={{ color: "#fff" }}
        >
          {title}
        </h1>
        {status && <StatusBadge status={status} />}
      </div>

      <div className="flex items-center gap-2">
        {children}
      </div>
    </div>
  );
}
