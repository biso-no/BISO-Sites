"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Switch } from "@repo/ui/components/ui/switch";
import { formatDistanceToNow } from "date-fns";
import { AlertCircle, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface SaveBarProps {
  autosaveEnabled: boolean;
  cancelLabel?: string;
  isDirty: boolean;
  isSubmitting: boolean;
  lastSaved?: Date | null;
  onAutosaveToggle: (enabled: boolean) => void;
  onCancel: () => void;
  onSave: () => void;
  saveLabel?: string;
  status: SaveStatus;
}

const STATUS_CONFIG: Record<
  SaveStatus,
  { icon: typeof Loader2; color: string; label: string }
> = {
  idle: {
    icon: Clock,
    color: "text-muted-foreground",
    label: "Unsaved changes",
  },
  saving: { icon: Loader2, color: "text-amber-500", label: "Saving…" },
  saved: { icon: CheckCircle2, color: "text-emerald-500", label: "Saved" },
  error: { icon: AlertCircle, color: "text-destructive", label: "Save failed" },
};

export function SaveBar({
  status,
  lastSaved,
  isDirty,
  isSubmitting,
  onSave,
  onCancel,
  autosaveEnabled,
  onAutosaveToggle,
  saveLabel = "Save",
  cancelLabel = "Cancel",
}: SaveBarProps) {
  const [relativeTime, setRelativeTime] = useState<string>("");

  // Refresh the "Saved Xs ago" counter every 15 s
  useEffect(() => {
    if (!lastSaved) {
      return;
    }
    const update = () =>
      setRelativeTime(formatDistanceToNow(lastSaved, { addSuffix: true }));
    update();
    const id = setInterval(update, 15_000);
    return () => clearInterval(id);
  }, [lastSaved]);

  const { icon: StatusIcon, color, label } = STATUS_CONFIG[status];
  const showTime = status === "saved" && lastSaved && relativeTime;

  return (
    <div
      className={cn(
        "fixed right-0 bottom-0 left-0 z-50 border-border/60 border-t bg-background/95 backdrop-blur-sm",
        "supports-backdrop-filter:bg-background/80"
      )}
    >
      <div className="mx-auto flex max-w-(--breakpoint-2xl) items-center justify-between gap-4 px-6 py-3">
        {/* Left — status */}
        <div className="flex items-center gap-3">
          <div className={cn("flex items-center gap-1.5 text-sm", color)}>
            <StatusIcon
              className={cn("h-4 w-4", status === "saving" && "animate-spin")}
            />
            <span>{showTime ? `Saved ${relativeTime}` : label}</span>
          </div>

          <div className="hidden h-4 w-px bg-border sm:block" />

          {/* Autosave toggle */}
          <label
            className="hidden cursor-pointer items-center gap-2 text-muted-foreground text-xs sm:flex"
            htmlFor="autosave-toggle"
          >
            <Switch
              aria-label="Toggle autosave"
              checked={autosaveEnabled}
              id="autosave-toggle"
              onCheckedChange={onAutosaveToggle}
            />
            Autosave
          </label>
        </div>

        {/* Right — actions */}
        <div className="flex items-center gap-2">
          <Button
            className="text-muted-foreground"
            disabled={isSubmitting}
            onClick={onCancel}
            size="sm"
            type="button"
            variant="ghost"
          >
            {cancelLabel}
          </Button>
          <Button
            className="min-w-[90px]"
            disabled={isSubmitting || (!isDirty && status !== "error")}
            onClick={onSave}
            size="sm"
            type="button"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              saveLabel
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
