"use client";

import {
  Briefcase,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Newspaper,
  XCircle,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  approveDraft,
  type DraftItem,
  rejectDraft,
} from "../../_actions/drafts";
import { SERIF_STACK, STUDIO } from "../../_components/studio";

const TYPE_ICONS = {
  job: Briefcase,
  event: Calendar,
  news: Newspaper,
} as const;

const TYPE_COLORS = {
  event: STUDIO.claret,
  job: STUDIO.sky,
  news: STUDIO.leaf,
} as const;

const EDIT_PATHS = {
  job: "/jobs",
  event: "/events",
  news: "/news",
} as const;

interface DraftsReviewClientProps {
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
}

export function DraftsReviewClient({
  drafts,
  labels,
}: DraftsReviewClientProps) {
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
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {drafts.map((draft) => {
        const Icon = TYPE_ICONS[draft.type];
        const color = TYPE_COLORS[draft.type];
        const typeLabel = labels.types[draft.type];
        const editPath = `${EDIT_PATHS[draft.type]}/${draft.id}`;

        return (
          <div
            className="flex flex-col overflow-hidden rounded-2xl border"
            key={`${draft.type}-${draft.id}`}
            style={{
              background: "rgba(255,255,255,0.46)",
              borderColor: STUDIO.rule,
            }}
          >
            <div
              className="relative flex h-28 items-center justify-center overflow-hidden"
              style={{
                background: STUDIO.paper2,
              }}
            >
              {draft.image ? (
                <Image
                  alt={draft.title}
                  className="object-cover opacity-60"
                  fill
                  src={draft.image}
                />
              ) : (
                <Icon size={28} style={{ color: `${color}80` }} />
              )}
              <div
                className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium text-[10px] uppercase"
                style={{
                  background: `${color}20`,
                  border: `0.5px solid ${color}40`,
                  color,
                }}
              >
                <Icon size={10} />
                {typeLabel}
              </div>
            </div>

            <div className="flex-1 p-4">
              <p
                className="text-2xl leading-7"
                style={{ color: STUDIO.ink, fontFamily: SERIF_STACK }}
              >
                {draft.title}
              </p>
              <p className="mt-1 text-xs" style={{ color: STUDIO.ink4 }}>
                {new Date(draft.updatedAt).toLocaleDateString()}
              </p>
            </div>

            <div className="flex items-center gap-2 p-4 pt-0">
              <Link
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                href={editPath}
                style={{
                  background: STUDIO.paper2,
                  color: STUDIO.ink3,
                }}
                title={labels.preview}
              >
                <ExternalLink size={13} />
              </Link>
              <button
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 font-medium text-xs transition-all"
                onClick={() => handleReject(draft.id, draft.type)}
                style={{
                  background: "rgba(107,30,30,0.08)",
                  border: "0.5px solid rgba(107,30,30,0.2)",
                  color: STUDIO.claret,
                }}
                type="button"
              >
                <XCircle size={13} />
                {labels.reject}
              </button>
              <button
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 font-medium text-xs transition-all"
                onClick={() => handleApprove(draft.id, draft.type)}
                style={{
                  background: "rgba(47,93,58,0.08)",
                  border: "0.5px solid rgba(47,93,58,0.22)",
                  color: STUDIO.leaf,
                }}
                type="button"
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
