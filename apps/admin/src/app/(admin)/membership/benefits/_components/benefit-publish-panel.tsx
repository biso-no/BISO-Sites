"use client";

import { BenefitStatus } from "@repo/api/types/appwrite";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { Separator } from "@repo/ui/components/ui/separator";
import { CheckCircle2, FileEdit, Loader2, RadioTower, Save } from "lucide-react";
import type { BenefitEditorForm } from "./use-benefit-editor";

interface BenefitPublishPanelProps {
  form: BenefitEditorForm;
  onSave: (publish: boolean) => void;
}

const STATUS_CONFIG = {
  [BenefitStatus.DRAFT]: {
    label: "Draft",
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
    dot: "bg-amber-400",
  },
  [BenefitStatus.PUBLISHED]: {
    label: "Published",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400",
    dot: "bg-emerald-400",
  },
  [BenefitStatus.ARCHIVED]: {
    label: "Archived",
    className:
      "border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-400",
    dot: "bg-zinc-400",
  },
};

export function BenefitPublishPanel({ form, onSave }: BenefitPublishPanelProps) {
  return (
    <form.Subscribe
      selector={(state) => ({
        status: state.values.status,
        isSubmitting: state.isSubmitting,
        isDirty: state.isDirty,
      })}
    >
      {({ status, isSubmitting, isDirty }) => {
        const config =
          STATUS_CONFIG[status] ?? STATUS_CONFIG[BenefitStatus.DRAFT];
        const isLive = status === BenefitStatus.PUBLISHED;

        // Publish button: always enabled for drafts, enabled for published
        // only when there are unsaved changes.
        const publishDisabled = isSubmitting || (isLive && !isDirty);
        const publishLabel = isLive
          ? isDirty
            ? "Save & keep published"
            : "Up to date"
          : "Publish now";

        return (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <RadioTower className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base font-semibold">
                  Publish
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Status indicator */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge
                  variant="outline"
                  className={`flex items-center gap-1.5 font-medium ${config.className}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
                  {config.label}
                  {isDirty && (
                    <span className="ml-0.5 text-[10px] opacity-70">
                      · unsaved
                    </span>
                  )}
                </Badge>
              </div>

              <Separator />

              {/* Actions */}
              <div className="space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={isSubmitting}
                  onClick={() => onSave(false)}
                >
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : isLive ? (
                    <FileEdit className="mr-2 h-4 w-4" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {isLive ? "Unpublish & save draft" : "Save as draft"}
                </Button>

                <Button
                  type="button"
                  className="w-full"
                  disabled={publishDisabled}
                  onClick={() => onSave(true)}
                >
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  {publishLabel}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      }}
    </form.Subscribe>
  );
}
