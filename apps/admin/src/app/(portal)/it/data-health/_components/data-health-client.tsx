"use client";

import type {
  DepartmentDataHealthEntry,
  DepartmentDataIssue,
} from "@repo/shared/types/user-management";
import { ShieldCheck } from "lucide-react";
import { EmptyState } from "../../../_components/empty-state";
import { STUDIO } from "../../../_components/studio";

interface DataHealthClientProps {
  entries: DepartmentDataHealthEntry[];
  labels: {
    empty: string;
    emptyDescription: string;
    columnName: string;
    columnCampus: string;
    columnIssues: string;
    issues: Record<DepartmentDataIssue, string>;
  };
}

const GRID =
  "grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.5fr)] gap-4";

export function DataHealthClient({ entries, labels }: DataHealthClientProps) {
  if (entries.length === 0) {
    return (
      <EmptyState
        description={labels.emptyDescription}
        icon={<ShieldCheck size={28} />}
        title={labels.empty}
      />
    );
  }

  return (
    <div className="space-y-2">
      <div
        className={`${GRID} px-5 pb-1 font-medium text-[11px] uppercase tracking-[0.06em]`}
        style={{ color: STUDIO.ink4 }}
      >
        <span>{labels.columnName}</span>
        <span>{labels.columnCampus}</span>
        <span>{labels.columnIssues}</span>
      </div>
      {entries.map((entry) => (
        <div
          className={`${GRID} items-center rounded-2xl px-5 py-4`}
          key={entry.id}
          style={{
            background: "rgba(255,255,255,0.46)",
            border: `0.5px solid ${STUDIO.rule}`,
          }}
        >
          <p
            className="truncate font-medium text-sm"
            style={{ color: STUDIO.ink }}
          >
            <code>{`"${entry.name}"`}</code>
          </p>
          <p className="truncate text-xs" style={{ color: STUDIO.ink3 }}>
            {entry.campusName}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {entry.issues.map((issue) => (
              <span
                className="inline-flex items-center rounded-full px-2.5 py-1 text-xs"
                key={issue}
                style={{
                  background: "rgba(176,138,62,0.09)",
                  color: "#6a5118",
                }}
              >
                {labels.issues[issue]}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
