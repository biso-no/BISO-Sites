"use client";

import { Button } from "@repo/ui/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { FileText, X } from "lucide-react";

type DraftRestoreBannerProps = {
  savedAt: Date;
  onRestore: () => void;
  onDiscard: () => void;
};

export function DraftRestoreBanner({
  savedAt,
  onRestore,
  onDiscard,
}: DraftRestoreBannerProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800/40 dark:bg-amber-900/20">
      <FileText className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <p className="flex-1 text-amber-800 dark:text-amber-300">
        You have an unsaved draft from{" "}
        <span className="font-medium">
          {formatDistanceToNow(savedAt, { addSuffix: true })}
        </span>
        . Would you like to restore it?
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-amber-300 bg-white hover:bg-amber-50 dark:border-amber-700 dark:bg-transparent"
          onClick={onRestore}
        >
          Restore draft
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-amber-600 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-900/40"
          onClick={onDiscard}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Discard draft</span>
        </Button>
      </div>
    </div>
  );
}
