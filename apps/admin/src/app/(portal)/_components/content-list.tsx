"use client";

import { type LucideIcon, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useState, useTransition } from "react";
import { toast } from "sonner";
import { EmptyState } from "./empty-state";
import { PaginationBar } from "./pagination-bar";
import { SearchToolbar } from "./search-toolbar";
import { STUDIO, StudioLinkButton } from "./studio";

export interface ContentListLabels {
  all: string;
  delete: string;
  deleteConfirm: string;
  draft: string;
  edit: string;
  empty: string;
  emptyDescription: string;
  published: string;
  searchPlaceholder: string;
}

interface ContentListProps<T extends { $id: string; status: string }> {
  /** Edit links go to `${basePath}/<id>`, the first-item link to `${basePath}/new`. */
  basePath: string;
  createLabel: string;
  /** Deletes one item and says how it went; true once it is gone. */
  deleteItem: (id: string) => Promise<boolean>;
  icon: LucideIcon;
  items: T[];
  labels: ContentListLabels;
  /** Whether `item` matches a non-empty search. */
  matches: (item: T, search: string) => boolean;
  noMatchingTitle: string;
  page: number;
  pageSize: number;
  /** What the row shows inside its text column. */
  renderBody: (item: T) => ReactNode;
  /** What the row shows before its text: a crest or a thumbnail. */
  renderLead: (item: T) => ReactNode;
  total: number;
}

/**
 * An admin content list: search, a status filter, the rows with edit and
 * delete, and paging. Delete asks first: the first click arms the bin and
 * shows `labels.deleteConfirm`, the second deletes.
 */
export function ContentList<T extends { $id: string; status: string }>({
  basePath,
  createLabel,
  deleteItem,
  icon: Icon,
  items,
  labels,
  matches,
  noMatchingTitle,
  page,
  pageSize,
  renderBody,
  renderLead,
  total,
}: ContentListProps<T>) {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
    null
  );
  const [, startTransition] = useTransition();

  const filters = [
    { label: labels.all, value: "all" },
    { label: labels.published, value: "published" },
    { label: labels.draft, value: "draft" },
  ];

  const filtered = items.filter(
    (item) =>
      (!search || matches(item, search)) &&
      (activeFilter === "all" || item.status === activeFilter)
  );

  function handleDelete(id: string) {
    if (confirmingDeleteId !== id) {
      setConfirmingDeleteId(id);
      toast.message(labels.deleteConfirm);
      return;
    }
    startTransition(async () => {
      if (await deleteItem(id)) {
        setConfirmingDeleteId(null);
      }
    });
  }

  if (items.length === 0 && page === 1) {
    return (
      <EmptyState
        description={labels.emptyDescription}
        icon={<Icon size={28} />}
        title={labels.empty}
      >
        <StudioLinkButton href={`${basePath}/new`} variant="primary">
          {createLabel}
        </StudioLinkButton>
      </EmptyState>
    );
  }

  return (
    <>
      <SearchToolbar
        activeFilter={activeFilter}
        filters={filters}
        onFilterChange={setActiveFilter}
        onSearch={setSearch}
        placeholder={labels.searchPlaceholder}
      />
      {filtered.length === 0 ? (
        <EmptyState icon={<Icon size={28} />} title={noMatchingTitle} />
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const isConfirmingDelete = confirmingDeleteId === item.$id;
            return (
              <div
                className="group flex items-center gap-4 rounded-2xl border px-5 py-4 transition hover:bg-white/70"
                key={item.$id}
                style={{
                  background: "rgba(255,255,255,0.46)",
                  borderColor: STUDIO.rule,
                }}
              >
                {renderLead(item)}

                <div className="min-w-0 flex-1">{renderBody(item)}</div>

                <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <Link
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    href={`${basePath}/${item.$id}`}
                    style={{
                      background: STUDIO.paper2,
                      color: STUDIO.ink3,
                    }}
                    title={labels.edit}
                  >
                    <Pencil size={13} />
                  </Link>
                  <button
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    onClick={() => handleDelete(item.$id)}
                    style={{
                      background: isConfirmingDelete
                        ? STUDIO.claret
                        : "rgba(107,30,30,0.08)",
                      color: isConfirmingDelete ? STUDIO.paper : STUDIO.claret,
                    }}
                    title={labels.delete}
                    type="button"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <PaginationBar page={page} size={pageSize} total={total} />
    </>
  );
}
