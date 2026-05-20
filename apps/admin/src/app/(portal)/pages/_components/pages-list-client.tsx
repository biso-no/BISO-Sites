"use client";

import type { Pages } from "@repo/api/types/appwrite";
import { FileText, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deletePageAction } from "../../_actions/pages";
import { EmptyState } from "../../_components/empty-state";
import { StatusBadge } from "../../_components/status-badge";
import {
  SERIF_STACK,
  STUDIO,
  StudioLinkButton,
} from "../../_components/studio";

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

export function PagesListClient({
  initialPages,
  labels,
}: PagesListClientProps) {
  const [, startTransition] = useTransition();
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    title: string;
  } | null>(null);

  function getPageTitle(page: Pages) {
    const translations = Array.isArray(page.translation_refs)
      ? page.translation_refs
      : [];
    return (
      translations.find((translation) => translation.locale === "no")?.title ??
      translations[0]?.title ??
      page.slug ??
      page.$id
    );
  }

  function confirmDelete() {
    if (!pendingDelete) {
      return;
    }
    const { id } = pendingDelete;
    setPendingDelete(null);
    startTransition(async () => {
      await deletePageAction(id);
      toast.success("Page deleted");
    });
  }

  if (initialPages.length === 0) {
    return <EmptyState icon={<FileText size={28} />} title={labels.empty} />;
  }

  return (
    <>
      <div className="space-y-3">
        {initialPages.map((page) => (
          <div
            className="group flex items-center gap-4 rounded-2xl border px-5 py-4 transition hover:bg-white/70"
            key={page.$id}
            style={{
              background: "rgba(255,255,255,0.46)",
              borderColor: STUDIO.rule,
            }}
          >
            <div className="min-w-0 flex-1">
              <Link
                className="truncate font-medium text-sm hover:underline"
                href={`/pages/${page.$id}`}
                style={{ color: STUDIO.ink, fontFamily: SERIF_STACK }}
              >
                {getPageTitle(page)}
              </Link>
              {page.slug && (
                <p
                  className="mt-0.5 truncate text-xs"
                  style={{ color: STUDIO.ink3 }}
                >
                  /{page.slug}
                </p>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-3">
              {page.$updatedAt && (
                <span
                  className="hidden text-xs sm:block"
                  style={{ color: STUDIO.ink4 }}
                >
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
                aria-label={labels.delete}
                className="flex h-8 w-8 items-center justify-center rounded-lg border opacity-0 transition hover:bg-red-50 group-hover:opacity-100"
                onClick={() =>
                  setPendingDelete({ id: page.$id, title: getPageTitle(page) })
                }
                style={{ borderColor: STUDIO.rule2 }}
                type="button"
              >
                <Trash2 size={14} style={{ color: STUDIO.ink3 }} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {pendingDelete && (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-black/20 backdrop-blur-sm"
          role="alertdialog"
        >
          <div
            className="w-[min(360px,calc(100vw-32px))] rounded-lg border p-5 shadow-2xl"
            style={{ background: STUDIO.paper, borderColor: STUDIO.rule2 }}
          >
            <div className="font-medium text-sm" style={{ color: STUDIO.ink }}>
              Delete page?
            </div>
            <p className="mt-2 text-sm" style={{ color: STUDIO.ink3 }}>
              Delete "{pendingDelete.title}"?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                className="rounded-lg border px-3 py-2 text-sm"
                onClick={() => setPendingDelete(null)}
                style={{ borderColor: STUDIO.rule2, color: STUDIO.ink2 }}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-lg px-3 py-2 text-sm"
                onClick={confirmDelete}
                style={{ background: STUDIO.claret, color: STUDIO.paper }}
                type="button"
              >
                {labels.delete}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
