"use client";

import type { RecruitmentApplicationRecord } from "@repo/shared/types/recruitment";
import { KanbanSquare, List } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { JobApplicationsClient } from "./job-applications-client";
import { JobApplicationsKanban } from "./job-applications-kanban";

interface Props {
  detailRouteBase?: string;
  initialApplications: RecruitmentApplicationRecord[];
  initialView: "list" | "kanban";
  jobId?: string;
  page: number;
  title: string;
  total: number;
}

export function JobApplicationsViewSwitcher({
  initialApplications,
  page,
  title,
  total,
  initialView,
  jobId,
  detailRouteBase,
}: Props) {
  const router = useRouter();
  const [view, setView] = useState<"list" | "kanban">(initialView);

  function changeView(next: "list" | "kanban") {
    setView(next);
    if (typeof window === "undefined") {
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set("view", next);
    router.replace(`${url.pathname}?${url.searchParams.toString()}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <button
          aria-pressed={view === "list"}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs"
          onClick={() => changeView("list")}
          style={{
            background:
              view === "list"
                ? "rgba(61,169,224,0.16)"
                : "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: view === "list" ? "#7dd3fc" : "rgba(255,255,255,0.6)",
          }}
          type="button"
        >
          <List size={13} />
          List
        </button>
        <button
          aria-pressed={view === "kanban"}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs"
          onClick={() => changeView("kanban")}
          style={{
            background:
              view === "kanban"
                ? "rgba(61,169,224,0.16)"
                : "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: view === "kanban" ? "#7dd3fc" : "rgba(255,255,255,0.6)",
          }}
          type="button"
        >
          <KanbanSquare size={13} />
          Kanban
        </button>
      </div>

      {view === "kanban" ? (
        <>
          <JobApplicationsKanban
            applications={initialApplications}
            jobId={jobId}
            onAfterStatusChange={() => router.refresh()}
            onSelect={(applicationId) => {
              if (detailRouteBase) {
                router.push(`${detailRouteBase}/${applicationId}`);
              }
            }}
          />
          {detailRouteBase ? (
            <p
              className="text-center text-xs"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              Click a card to open the full application detail.
            </p>
          ) : (
            <p
              className="text-center text-xs"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              Drag cards between columns to update status. Status transitions
              are server-validated.
            </p>
          )}
        </>
      ) : (
        <JobApplicationsClient
          initialApplications={initialApplications}
          page={page}
          title={title}
          total={total}
        />
      )}

      {detailRouteBase ? (
        <p
          className="text-center text-xs"
          style={{ color: "rgba(255,255,255,0.3)" }}
        >
          Need the full detail view?{" "}
          <Link
            className="underline"
            href={`${detailRouteBase}/${initialApplications[0]?.$id ?? ""}`}
          >
            Open detail page
          </Link>
        </p>
      ) : null}
    </div>
  );
}
