"use client";

import { CheckCheck, ChevronLeft, ChevronRight, Eye, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { deleteSubmission, updateSubmissionStatus, type FormSubmission } from "../../../_actions/submissions";

interface Props {
  page: number;
  rows: FormSubmission[];
  topic: string;
  total: number;
}

const STATUS_LABELS: Record<FormSubmission["status"], string> = {
  new: "New",
  read: "Read",
  actioned: "Actioned",
  archived: "Archived",
};

const STATUS_COLORS: Record<FormSubmission["status"], string> = {
  new: "bg-blue-100 text-blue-800",
  read: "bg-gray-100 text-gray-700",
  actioned: "bg-green-100 text-green-800",
  archived: "bg-amber-100 text-amber-800",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("no", { dateStyle: "medium", timeStyle: "short" });
}

function parseData(json: string): Record<string, string> {
  try { return JSON.parse(json); } catch { return {}; }
}

export function SubmissionsList({ rows, topic, page, total }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const pageSize = 25;
  const totalPages = Math.ceil(total / pageSize);

  function handleStatus(id: string, status: FormSubmission["status"]) {
    startTransition(() => updateSubmissionStatus(id, status, topic));
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this submission? This cannot be undone.")) return;
    startTransition(() => deleteSubmission(id, topic));
  }

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground py-12 text-center">No submissions found.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="divide-y border rounded-xl overflow-hidden bg-card">
        {rows.map((sub) => {
          const data = parseData(sub.dataJson);
          const isOpen = expanded === sub.$id;
          return (
            <div key={sub.$id} className={`transition-colors ${sub.status === "new" ? "bg-blue-50/40" : ""}`}>
              <div className="flex items-center gap-3 px-4 py-3">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_COLORS[sub.status]}`}>
                  {STATUS_LABELS[sub.status]}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {Object.values(data)[0] ?? "—"}
                  </div>
                  <div className="text-xs text-muted-foreground">{formatDate(sub.$createdAt)}</div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    aria-label="Expand"
                    className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground"
                    onClick={() => setExpanded(isOpen ? null : sub.$id)}
                    type="button"
                  >
                    <Eye size={14} />
                  </button>
                  {sub.status !== "actioned" && (
                    <button
                      aria-label="Mark actioned"
                      className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground"
                      disabled={isPending}
                      onClick={() => handleStatus(sub.$id, "actioned")}
                      type="button"
                    >
                      <CheckCheck size={14} />
                    </button>
                  )}
                  <button
                    aria-label="Delete"
                    className="p-1.5 rounded hover:bg-destructive/10 text-destructive transition-colors"
                    disabled={isPending}
                    onClick={() => handleDelete(sub.$id)}
                    type="button"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {isOpen && (
                <div className="px-4 pb-4 border-t bg-muted/20">
                  <table className="w-full text-sm mt-3">
                    <tbody>
                      {Object.entries(data).map(([k, v]) => (
                        <tr key={k} className="align-top">
                          <td className="py-1 pr-4 font-medium text-muted-foreground whitespace-nowrap w-1/3">{k}</td>
                          <td className="py-1 break-words">{v}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="flex gap-2 mt-4">
                    {(["new", "read", "actioned", "archived"] as FormSubmission["status"][])
                      .filter((s) => s !== sub.status)
                      .map((s) => (
                        <button
                          key={s}
                          className="text-xs px-3 py-1 rounded border hover:bg-muted transition-colors"
                          disabled={isPending}
                          onClick={() => handleStatus(sub.$id, s)}
                          type="button"
                        >
                          Mark {STATUS_LABELS[s]}
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Page {page} of {totalPages} · {total} total</span>
          <div className="flex gap-2">
            {page > 1 && (
              <a className="flex items-center gap-1 hover:text-foreground" href={`?page=${page - 1}`}>
                <ChevronLeft size={14} /> Prev
              </a>
            )}
            {page < totalPages && (
              <a className="flex items-center gap-1 hover:text-foreground" href={`?page=${page + 1}`}>
                Next <ChevronRight size={14} />
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
