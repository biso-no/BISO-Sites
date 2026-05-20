"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { SubmissionTopic } from "../../_actions/submissions";

interface Props {
  topics: SubmissionTopic[];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("no", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function SubmissionTopicList({ topics }: Props) {
  return (
    <div className="divide-y overflow-hidden rounded-xl border bg-card">
      {topics.map((t) => (
        <Link
          className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/40"
          href={`/submissions/${encodeURIComponent(t.topic)}`}
          key={t.topic}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium text-sm">
                {t.formHeading}
              </span>
              {t.unreadCount > 0 && (
                <span className="flex-shrink-0 rounded-full bg-primary px-2 py-0.5 font-semibold text-primary-foreground text-xs">
                  {t.unreadCount} new
                </span>
              )}
            </div>
            <div className="mt-0.5 text-muted-foreground text-xs">
              {t.count} submission{t.count === 1 ? "" : "s"} · Last received{" "}
              {formatDate(t.latestAt)}
              {t.campusId && ` · ${t.campusId.toUpperCase()}`}
            </div>
          </div>
          <ChevronRight
            className="flex-shrink-0 text-muted-foreground"
            size={16}
          />
        </Link>
      ))}
    </div>
  );
}
