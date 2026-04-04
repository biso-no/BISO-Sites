import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { StatusBadge } from "./status-badge";

interface EditorHeaderProps {
  backHref: string;
  backLabel: string;
  children?: ReactNode;
  discardLabel?: string;
  isSubmitting?: boolean;
  onDiscard?: () => void;
  publishLabel?: string;
  saveDraftLabel?: string;
  status?: string;
  title: string;
}

export function EditorHeader({
  backHref,
  backLabel,
  title,
  status,
  children,
}: EditorHeaderProps) {
  return (
    <div
      className="sticky top-0 z-30 mb-8 flex items-center gap-4 px-6 py-4"
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
        aria-label={backLabel}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors"
        href={backHref}
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.10)",
          color: "rgba(255,255,255,0.60)",
        }}
      >
        <ArrowLeft size={15} />
      </Link>

      <div className="flex min-w-0 flex-1 items-center gap-3">
        <h1
          className="truncate font-medium text-base"
          style={{ color: "#fff" }}
        >
          {title}
        </h1>
        {status && <StatusBadge status={status} />}
      </div>

      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}
