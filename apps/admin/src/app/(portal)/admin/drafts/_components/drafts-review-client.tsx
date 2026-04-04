"use client";

import { useTransition } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  XCircle,
  Briefcase,
  Calendar,
  Newspaper,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { approveDraft, rejectDraft, type DraftItem } from "../../_actions/drafts";

const TYPE_ICONS = {
  job: Briefcase,
  event: Calendar,
  news: Newspaper,
} as const;

const TYPE_COLORS = {
  job: "#3DA9E0",
  event: "#a78bfa",
  news: "#4ade80",
} as const;

const EDIT_PATHS = {
  job: "/admin/jobs",
  event: "/admin/events",
  news: "/admin/news",
} as const;

type DraftsReviewClientProps = {
  drafts: DraftItem[];
  labels: {
    approve: string;
    reject: string;
    preview: string;
    approveSuccess: string;
    approveError: string;
    rejectSuccess: string;
    rejectError: string;
    types: { job: string; event: string; news: string };
  };
};

export function DraftsReviewClient({ drafts, labels }: DraftsReviewClientProps) {
  const [, startTransition] = useTransition();

  function handleApprove(id: string, type: DraftItem["type"]) {
    startTransition(async () => {
      const result = await approveDraft(id, type);
      if (result.error) {
        toast.error(labels.approveError);
      } else {
        toast.success(labels.approveSuccess);
      }
    });
  }

  function handleReject(id: string, type: DraftItem["type"]) {
    startTransition(async () => {
      const result = await rejectDraft(id, type);
      if (result.error) {
        toast.error(labels.rejectError);
      } else {
        toast.success(labels.rejectSuccess);
      }
    });
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {drafts.map((draft) => {
        const Icon = TYPE_ICONS[draft.type];
        const color = TYPE_COLORS[draft.type];
        const typeLabel = labels.types[draft.type];
        const editPath = `${EDIT_PATHS[draft.type]}/${draft.id}`;

        return (
          <div
            key={`${draft.type}-${draft.id}`}
            className="flex flex-col rounded-3xl overflow-hidden"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
          >
            {/* Hero */}
            <div
              className="relative h-28 overflow-hidden flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${color}15, rgba(0,10,22,0.80))`,
              }}
            >
              {draft.image ? (
                <img
                  src={draft.image}
                  alt={draft.title}
                  className="w-full h-full object-cover opacity-60"
                />
              ) : (
                <Icon size={28} style={{ color: `${color}80` }} />
              )}
              <div
                className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase"
                style={{
                  background: `${color}20`,
                  border: `1px solid ${color}40`,
                  color,
                }}
              >
                <Icon size={10} />
                {typeLabel}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 p-4">
              <p
                className="font-medium text-sm leading-snug"
                style={{ color: "#fff" }}
              >
                {draft.title}
              </p>
              <p
                className="text-xs mt-1"
                style={{ color: "rgba(255,255,255,0.35)" }}
              >
                {new Date(draft.updatedAt).toLocaleDateString()}
              </p>
            </div>

            {/* Actions */}
            <div
              className="flex items-center gap-2 p-4 pt-0"
            >
              <Link
                href={editPath}
                className="flex items-center justify-center w-8 h-8 rounded-xl flex-shrink-0"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  color: "rgba(255,255,255,0.50)",
                }}
                title={labels.preview}
              >
                <ExternalLink size={13} />
              </Link>
              <button
                type="button"
                onClick={() => handleReject(draft.id, draft.type)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-all"
                style={{
                  background: "rgba(248,113,113,0.08)",
                  border: "1px solid rgba(248,113,113,0.20)",
                  color: "#f87171",
                }}
              >
                <XCircle size={13} />
                {labels.reject}
              </button>
              <button
                type="button"
                onClick={() => handleApprove(draft.id, draft.type)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-all"
                style={{
                  background: "rgba(74,222,128,0.10)",
                  border: "1px solid rgba(74,222,128,0.25)",
                  color: "#4ade80",
                }}
              >
                <CheckCircle2 size={13} />
                {labels.approve}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
