"use client";

import { JobApplicationsStatus } from "@repo/api/types/appwrite";
import {
  canTransitionRecruitmentApplicationStatus,
  type RecruitmentApplicationRecord,
} from "@repo/shared/types/recruitment";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateJobApplicationStatus } from "../../_actions/jobs";
import { STUDIO } from "../../_components/studio";

interface KanbanProps {
  applications: RecruitmentApplicationRecord[];
  jobId?: string;
  onAfterStatusChange?: () => void;
  onSelect?: (applicationId: string) => void;
}

interface Column {
  accent: string;
  id: JobApplicationsStatus;
  label: string;
}

const COLUMNS: Column[] = [
  { accent: "#3DA9E0", id: JobApplicationsStatus.SUBMITTED, label: "New" },
  { accent: "#A78BFA", id: JobApplicationsStatus.REVIEWED, label: "Reviewed" },
  {
    accent: "#F59E0B",
    id: JobApplicationsStatus.INTERVIEW,
    label: "Interview",
  },
  { accent: "#22C55E", id: JobApplicationsStatus.ACCEPTED, label: "Accepted" },
  { accent: "#EF4444", id: JobApplicationsStatus.REJECTED, label: "Rejected" },
];

function readScreeningScore(
  application: RecruitmentApplicationRecord
): number | null {
  return application.screening_score ?? null;
}

export function JobApplicationsKanban({
  applications,
  onSelect,
  onAfterStatusChange,
}: KanbanProps) {
  const [items, setItems] =
    useState<RecruitmentApplicationRecord[]>(applications);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<JobApplicationsStatus | null>(
    null
  );
  const [isPending, startTransition] = useTransition();

  // Keep the local board in sync when the server-provided list changes.
  if (applications !== items && !isPending && draggingId === null) {
    setItems(applications);
  }

  const byStatus = new Map<
    JobApplicationsStatus,
    RecruitmentApplicationRecord[]
  >();
  for (const column of COLUMNS) {
    byStatus.set(column.id, []);
  }
  for (const application of items) {
    const list = byStatus.get(application.status) ?? [];
    list.push(application);
    byStatus.set(application.status, list);
  }

  function handleDragStart(applicationId: string) {
    setDraggingId(applicationId);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDropTarget(null);
  }

  function handleDrop(
    columnStatus: JobApplicationsStatus,
    event: React.DragEvent<HTMLDivElement>
  ) {
    event.preventDefault();
    setDropTarget(null);
    if (!draggingId) {
      return;
    }
    const current = items.find((application) => application.$id === draggingId);
    setDraggingId(null);
    if (!current || current.status === columnStatus) {
      return;
    }
    if (
      !canTransitionRecruitmentApplicationStatus(current.status, columnStatus)
    ) {
      toast.error(
        `Can't move from ${current.status} to ${columnStatus} directly.`
      );
      return;
    }

    const previous = items;
    setItems((existing) =>
      existing.map((application) =>
        application.$id === draggingId
          ? { ...application, status: columnStatus }
          : application
      )
    );

    startTransition(async () => {
      const result = await updateJobApplicationStatus(draggingId, {
        status: columnStatus,
      });
      if ("error" in result && result.error) {
        toast.error(result.error);
        setItems(previous);
        return;
      }
      toast.success(`Moved to ${columnStatus}`);
      onAfterStatusChange?.();
    });
  }

  return (
    <div
      className="grid gap-4 overflow-x-auto pb-4"
      style={{
        gridTemplateColumns: `repeat(${COLUMNS.length}, minmax(240px, 1fr))`,
      }}
    >
      {COLUMNS.map((column) => {
        const cards = byStatus.get(column.id) ?? [];
        const isDropTarget = dropTarget === column.id;
        return (
          <div
            className="flex flex-col rounded-2xl p-3"
            key={column.id}
            onDragLeave={() => {
              setDropTarget((current) =>
                current === column.id ? null : current
              );
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setDropTarget(column.id);
            }}
            onDrop={(event) => handleDrop(column.id, event)}
            style={{
              background: isDropTarget ? STUDIO.paper3 : STUDIO.paper2,
              border: `1px solid ${isDropTarget ? column.accent : STUDIO.rule}`,
              minHeight: 200,
              transition: "background 150ms ease, border-color 150ms ease",
            }}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: column.accent }}
                />
                <span
                  className="font-medium text-sm"
                  style={{ color: STUDIO.ink2 }}
                >
                  {column.label}
                </span>
              </div>
              <span
                className="rounded-full px-2 py-0.5 text-xs"
                style={{
                  background: STUDIO.paper3,
                  color: STUDIO.ink4,
                }}
              >
                {cards.length}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {cards.map((application) => {
                const score = readScreeningScore(application);
                return (
                  <button
                    className="rounded-xl p-3 text-left transition-all"
                    draggable
                    key={application.$id}
                    onClick={() => onSelect?.(application.$id)}
                    onDragEnd={handleDragEnd}
                    onDragStart={() => handleDragStart(application.$id)}
                    style={{
                      background:
                        draggingId === application.$id
                          ? "rgba(61,169,224,0.08)"
                          : STUDIO.paper,
                      border: `1px solid ${draggingId === application.$id ? "rgba(61,169,224,0.30)" : STUDIO.rule}`,
                      cursor: "grab",
                      opacity: draggingId === application.$id ? 0.6 : 1,
                    }}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p
                          className="truncate font-medium text-sm"
                          style={{ color: STUDIO.ink }}
                        >
                          {application.applicant_name}
                        </p>
                        <p
                          className="truncate text-xs"
                          style={{ color: STUDIO.ink4 }}
                        >
                          {application.job?.title ?? "Unknown vacancy"}
                        </p>
                      </div>
                      {score === null ? null : (
                        <span
                          className="shrink-0 rounded-full px-2 py-0.5 text-xs"
                          style={{
                            background: "rgba(176,138,62,0.12)",
                            color: STUDIO.gold,
                          }}
                          title="AI screening score (0–100)"
                        >
                          {score}
                        </span>
                      )}
                    </div>
                    {application.review_metadata.assigned_hr_user_name ? (
                      <p
                        className="mt-2 truncate text-xs"
                        style={{ color: STUDIO.ink4 }}
                      >
                        @ {application.review_metadata.assigned_hr_user_name}
                      </p>
                    ) : null}
                  </button>
                );
              })}
              {cards.length === 0 ? (
                <p
                  className="rounded-lg p-3 text-center text-xs"
                  style={{ color: STUDIO.ink4 }}
                >
                  No applications here.
                </p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
