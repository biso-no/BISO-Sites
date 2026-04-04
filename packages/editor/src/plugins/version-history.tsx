"use client";

import type { Plugin } from "@puckeditor/core";
import { createUsePuck, useGetPuck } from "@puckeditor/core";

const usePuck = createUsePuck();

import {
  CheckCircle2,
  Circle,
  Clock,
  FileEdit,
  GitCompare,
  History,
  RotateCcw,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type VersionStatus = "draft" | "published";

interface VersionEntry {
  author: string;
  blockCount: number;
  id: string;
  number: number;
  snapshot: unknown;
  status: VersionStatus;
  timestamp: Date;
}

function formatTimeAgo(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (seconds < 10) {
    return "Just now";
  }
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  if (hours < 24) {
    return `${hours}h ago`;
  }
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: VersionStatus }) {
  if (status === "published") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 font-medium text-[10px] text-green-700 dark:bg-green-900/30 dark:text-green-400">
        <CheckCircle2 size={10} />
        Published
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 font-medium text-[10px] text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
      <FileEdit size={10} />
      Draft
    </span>
  );
}

function CurrentStatus({
  hasUnsavedChanges,
  lastSaved,
}: {
  hasUnsavedChanges: boolean;
  lastSaved: Date | null;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border p-3">
      <div
        className={`h-2 w-2 shrink-0 rounded-full ${
          hasUnsavedChanges ? "animate-pulse bg-yellow-500" : "bg-green-500"
        }`}
      />
      <div className="min-w-0 flex-1">
        <div className="font-medium text-foreground text-sm">
          {hasUnsavedChanges ? "Unsaved changes" : "All changes saved"}
        </div>
        <div className="text-muted-foreground text-xs">
          {lastSaved
            ? `Last saved ${formatTimeAgo(lastSaved)}`
            : "No saves this session"}
        </div>
      </div>
    </div>
  );
}

function VersionItem({
  version,
  isCurrent,
  onRestore,
}: {
  version: VersionEntry;
  isCurrent: boolean;
  onRestore: (version: VersionEntry) => void;
}) {
  return (
    <div className="relative flex gap-3 pb-4">
      {/* Timeline connector */}
      <div className="flex flex-col items-center">
        <div
          className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
            isCurrent
              ? "border-blue-500 bg-blue-500"
              : "border-border bg-background"
          }`}
        >
          {isCurrent ? (
            <Circle className="fill-white text-white" size={8} />
          ) : (
            <Circle className="text-muted-foreground" size={8} />
          )}
        </div>
        <div className="w-px flex-1 bg-border" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 space-y-1.5 pb-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground text-sm">
            v{version.number}
          </span>
          <StatusBadge status={version.status} />
        </div>
        <div className="text-muted-foreground text-xs">
          <span>{version.author}</span>
          <span className="mx-1.5">·</span>
          <span>{formatTimeAgo(version.timestamp)}</span>
        </div>
        <div className="text-muted-foreground text-xs">
          {version.blockCount} block{version.blockCount === 1 ? "" : "s"}
        </div>
        {!isCurrent && (
          <button
            className="mt-1 inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 font-medium text-foreground text-xs transition-colors hover:bg-muted"
            onClick={() => onRestore(version)}
            type="button"
          >
            <RotateCcw size={12} />
            Restore
          </button>
        )}
      </div>
    </div>
  );
}

function DiffPlaceholder() {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 font-semibold text-foreground text-sm">
        <GitCompare size={14} />
        Version Diff
      </div>
      <div className="flex flex-col items-center gap-2 rounded-md border border-border border-dashed p-4 text-center">
        <GitCompare className="text-muted-foreground" size={20} />
        <div className="text-muted-foreground text-sm">
          Compare with previous version
        </div>
        <div className="text-muted-foreground text-xs">
          Select a version to see what changed. Full diff support coming soon.
        </div>
      </div>
    </div>
  );
}

/**
 * Simple deep-equal-ish hash of content array length + block types.
 * Used to detect meaningful changes without expensive deep comparison.
 */
function contentFingerprint(content: unknown[]): string {
  return content
    .map((block: any) => `${block.type ?? "?"}:${block.props?.id ?? "?"}`)
    .join("|");
}

function VersionHistoryPanel() {
  const appState = usePuck((s) => s.appState);
  const getPuck = useGetPuck();

  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const lastFingerprintRef = useRef<string>("");
  const versionCounterRef = useRef(0);

  const content = appState.data.content ?? [];
  const currentFingerprint = useMemo(
    () => contentFingerprint(content),
    [content]
  );

  const lastSaved = useMemo(() => {
    if (versions.length === 0) {
      return null;
    }
    return versions[0]!.timestamp;
  }, [versions]);

  // Track changes and auto-snapshot when content structure changes
  useEffect(() => {
    if (!lastFingerprintRef.current) {
      // First render: capture initial state
      lastFingerprintRef.current = currentFingerprint;
      if (content.length > 0) {
        versionCounterRef.current += 1;
        setVersions([
          {
            id: crypto.randomUUID?.() ?? `v-${Date.now()}`,
            number: versionCounterRef.current,
            timestamp: new Date(),
            author: "You",
            status: "draft",
            blockCount: content.length,
            snapshot: structuredClone(appState.data),
          },
        ]);
      }
      return;
    }

    if (currentFingerprint !== lastFingerprintRef.current) {
      setHasUnsavedChanges(true);

      // Debounce: capture a snapshot after structure changes settle
      const timeout = setTimeout(() => {
        lastFingerprintRef.current = currentFingerprint;
        versionCounterRef.current += 1;
        const { appState: currentAppState } = getPuck();
        const entry: VersionEntry = {
          id: crypto.randomUUID?.() ?? `v-${Date.now()}`,
          number: versionCounterRef.current,
          timestamp: new Date(),
          author: "You",
          status: "draft",
          blockCount: content.length,
          snapshot: structuredClone(currentAppState.data),
        };
        setVersions((prev) => [entry, ...prev]);
        setHasUnsavedChanges(false);
      }, 2000);

      return () => clearTimeout(timeout);
    }
  }, [currentFingerprint, getPuck, content.length, appState.data]);

  const handleRestore = useCallback(
    (version: VersionEntry) => {
      if (!version.snapshot) {
        return;
      }
      const { dispatch } = getPuck();
      dispatch({
        type: "setData",
        recordHistory: true,
        data: version.snapshot as any,
      });
    },
    [getPuck]
  );

  return (
    <div className="space-y-6 p-4">
      <div>
        <div className="font-semibold text-foreground text-lg">
          Version History
        </div>
        <div className="text-muted-foreground text-sm">
          Track changes during your editing session.
        </div>
      </div>

      <CurrentStatus
        hasUnsavedChanges={hasUnsavedChanges}
        lastSaved={lastSaved}
      />

      {/* Version Timeline */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 font-semibold text-foreground text-sm">
          <Clock size={14} />
          Session Timeline
        </div>

        {versions.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-md border border-border border-dashed p-4 text-center">
            <History className="text-muted-foreground" size={20} />
            <div className="text-muted-foreground text-sm">No versions yet</div>
            <div className="text-muted-foreground text-xs">
              Snapshots are captured automatically when you add, remove, or
              reorder blocks.
            </div>
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto pr-1">
            {versions.map((version, index) => (
              <VersionItem
                isCurrent={index === 0}
                key={version.id}
                onRestore={handleRestore}
                version={version}
              />
            ))}
          </div>
        )}
      </div>

      <DiffPlaceholder />

      <div className="text-muted-foreground text-xs">
        {versions.length} snapshot{versions.length === 1 ? "" : "s"} this
        session
      </div>
    </div>
  );
}

export const versionHistoryPlugin: Plugin = {
  name: "version-history",
  label: "Version History",
  icon: <History size={18} />,
  render: () => <VersionHistoryPanel />,
};
