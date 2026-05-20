"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { SubmissionTopic } from "../../_actions/submissions";

interface Props {
  topics: SubmissionTopic[];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("no", { dateStyle: "medium", timeStyle: "short" });
}

export function SubmissionTopicList({ topics }: Props) {
  return (
    <div className="divide-y border rounded-xl overflow-hidden bg-card">
      {topics.map((t) => (
        <Link
          key={t.topic}
          className="flex items-center gap-4 px-5 py-4 hover:bg-muted/40 transition-colors"
          href={`/submissions/${encodeURIComponent(t.topic)}`}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm truncate">{t.formHeading}</span>
              {t.unreadCount > 0 && (
                <span className="rounded-full bg-primary text-primary-foreground text-xs px-2 py-0.5 font-semibold flex-shrink-0">
                  {t.unreadCount} new
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {t.count} submission{t.count !== 1 ? "s" : ""} · Last received {formatDate(t.latestAt)}
              {t.campusId && ` · ${t.campusId.toUpperCase()}`}
            </div>
          </div>
          <ChevronRight className="text-muted-foreground flex-shrink-0" size={16} />
        </Link>
      ))}
    </div>
  );
}
