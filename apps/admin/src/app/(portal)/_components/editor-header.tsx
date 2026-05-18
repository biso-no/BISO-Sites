import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { StatusBadge } from "./status-badge";
import { STUDIO } from "./studio";

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
        background: "rgba(250,247,242,0.9)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: `0.5px solid ${STUDIO.rule}`,
        marginLeft: "-3rem",
        marginRight: "-3rem",
      }}
    >
      <Link
        aria-label={backLabel}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors"
        href={backHref}
        style={{
          background: "rgba(255,255,255,0.55)",
          border: `0.5px solid ${STUDIO.rule2}`,
          color: STUDIO.ink3,
        }}
      >
        <ArrowLeft size={15} />
      </Link>

      <div className="flex min-w-0 flex-1 items-center gap-3">
        <h1
          className="truncate font-medium text-base"
          style={{ color: STUDIO.ink }}
        >
          {title}
        </h1>
        {status && <StatusBadge status={status} />}
      </div>

      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}
