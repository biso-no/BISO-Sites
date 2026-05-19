"use client";

import type { Pages } from "@repo/api/types/appwrite";
import { FileText, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { deletePageAction } from "../../_actions/pages";
import { EmptyState } from "../../_components/empty-state";
import { StatusBadge } from "../../_components/status-badge";
import { STUDIO, SERIF_STACK, StudioLinkButton } from "../../_components/studio";

interface PagesListClientProps {
  initialPages: Pages[];
  labels: {
    empty: string;
    all: string;
    published: string;
    draft: string;
    edit: string;
    delete: string;
  };
}

export function PagesListClient({ initialPages, labels }: PagesListClientProps) {
  const [, startTransition] = useTransition();

  function handleDelete(id: string, title: string | null) {
    if (!confirm(`Delete "${title ?? id}"?`)) return;
    startTransition(async () => {
      await deletePageAction(id);
      toast.success("Page deleted");
    });
  }

  if (initialPages.length === 0) {
    return (
      <EmptyState
        icon={<FileText size={28} />}
        title={labels.empty}
      />
    );
  }

  return (
    <div className="space-y-3">
      {initialPages.map((page) => (
        <div
          key={page.$id}
          className="group flex items-center gap-4 rounded-2xl border px-5 py-4 transition hover:bg-white/70"
          style={{ background: "rgba(255,255,255,0.46)", borderColor: STUDIO.rule }}
        >
          <div className="min-w-0 flex-1">
            <Link
              href={`/pages/${page.$id}`}
              className="truncate font-medium text-sm hover:underline"
              style={{ color: STUDIO.ink, fontFamily: SERIF_STACK }}
            >
              {page.title ?? page.slug ?? page.$id}
            </Link>
            {page.slug && (
              <p className="mt-0.5 text-xs truncate" style={{ color: STUDIO.ink3 }}>
                /{page.slug}
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {page.$updatedAt && (
              <span className="hidden text-xs sm:block" style={{ color: STUDIO.ink4 }}>
                {new Date(page.$updatedAt).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            )}
            <StatusBadge status={page.status} />
            <StudioLinkButton href={`/pages/${page.$id}`} variant="ghost">
              <Pencil size={14} />
              {labels.edit}
            </StudioLinkButton>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-lg border opacity-0 transition hover:bg-red-50 group-hover:opacity-100"
              style={{ borderColor: STUDIO.rule2 }}
              onClick={() => handleDelete(page.$id, page.title)}
              aria-label={labels.delete}
            >
              <Trash2 size={14} style={{ color: STUDIO.ink3 }} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
