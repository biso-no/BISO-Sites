"use client";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/ui/components/ui/alert-dialog";
import { CalendarDays, Copy, History, Loader2 } from "lucide-react";
import type { JobReuseSignals } from "@/lib/job-reuse";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  timeZone: "Europe/Oslo",
  year: "numeric",
});

function describeReasons(
  reuse: JobReuseSignals,
  applicationDeadline: string | null
): string[] {
  const lines: string[] = [];
  if (reuse.reasons.includes("closed")) {
    lines.push("It has been closed.");
  }
  if (reuse.reasons.includes("deadline_passed") && applicationDeadline) {
    lines.push(
      `Its application deadline passed on ${dateFormatter.format(new Date(applicationDeadline))}.`
    );
  }
  if (reuse.applicationCount > 0) {
    lines.push(
      reuse.applicationCount === 1
        ? "It already has 1 application."
        : `It already has ${reuse.applicationCount} applications.`
    );
  }
  return lines;
}

function consequence(reuse: JobReuseSignals) {
  return reuse.applicationCount > 0
    ? "Rewriting it for a new round puts new applicants in the same pipeline as the old ones, and the old round's text and dates are lost."
    : "Rewriting it for a new round overwrites the old round's text and dates.";
}

function DuplicateButton({
  isDuplicating,
  onDuplicate,
}: {
  isDuplicating: boolean;
  onDuplicate: () => void;
}) {
  return (
    <button
      className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#001731] px-4 py-2 font-medium text-sm text-white shadow-lg shadow-slate-950/10 transition hover:-translate-y-0.5 disabled:opacity-60"
      disabled={isDuplicating}
      onClick={onDuplicate}
      type="button"
    >
      {isDuplicating ? (
        <Loader2 className="animate-spin" size={15} />
      ) : (
        <Copy size={15} />
      )}
      {isDuplicating ? "Creating copy..." : "Duplicate as new vacancy"}
    </button>
  );
}

/**
 * Shown at the top of the studio when a vacancy looks like a past round.
 * Once HR chooses to keep editing it collapses to a one-line reminder.
 */
export function JobReuseBanner({
  acknowledged,
  applicationDeadline,
  dirty,
  isDuplicating,
  onAcknowledge,
  onDuplicate,
  reuse,
}: {
  acknowledged: boolean;
  applicationDeadline: string | null;
  dirty: boolean;
  isDuplicating: boolean;
  onAcknowledge: () => void;
  onDuplicate: () => void;
  reuse: JobReuseSignals;
}) {
  if (acknowledged) {
    return (
      <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-amber-900 text-sm">
        <History className="shrink-0" size={16} />
        <p className="flex-1">
          You're editing a vacancy from an earlier round. Changes apply to it
          directly.
        </p>
        <button
          className="font-medium underline-offset-2 hover:underline disabled:opacity-60"
          disabled={isDuplicating}
          onClick={onDuplicate}
          type="button"
        >
          {isDuplicating ? "Creating copy..." : "Duplicate instead"}
        </button>
      </div>
    );
  }

  return (
    <section
      aria-labelledby="job-reuse-title"
      className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm"
    >
      <div className="flex items-start gap-3">
        <History className="mt-0.5 shrink-0 text-amber-700" size={18} />
        <div className="min-w-0 flex-1">
          <h2
            className="font-medium text-[#001731] text-base"
            id="job-reuse-title"
          >
            Recruiting for a new round? Duplicate this vacancy instead.
          </h2>
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-amber-900">
            {describeReasons(reuse, applicationDeadline).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="mt-2 text-slate-700">
            {consequence(reuse)} A duplicate keeps the description, screening
            criteria, application questions and interview rounds, so you only
            need to set new dates.
          </p>
          {dirty && (
            <p className="mt-2 text-slate-500 text-xs">
              The copy is made from the last saved version. Edits you haven't
              saved here are not carried over.
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <DuplicateButton
              isDuplicating={isDuplicating}
              onDuplicate={onDuplicate}
            />
            <button
              className="rounded-lg px-3 py-2 font-medium text-slate-600 transition hover:bg-amber-100 hover:text-[#001731]"
              onClick={onAcknowledge}
              type="button"
            >
              Keep editing this one
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Interrupts the first edit (or a publish) on a past-round vacancy, so the
 * nudge lands before HR has sunk time into rewriting it.
 */
export function JobReuseDialog({
  applicationDeadline,
  intent,
  isDuplicating,
  onAcknowledge,
  onDuplicate,
  onOpenChange,
  open,
  reuse,
}: {
  applicationDeadline: string | null;
  intent: "edit" | "publish";
  isDuplicating: boolean;
  onAcknowledge: () => void;
  onDuplicate: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  reuse: JobReuseSignals;
}) {
  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent className="border border-slate-200 bg-[#faf7f2] text-[#07111f]">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-light text-2xl tracking-tight">
            {intent === "publish"
              ? "Republish a past vacancy?"
              : "Is this for a new round?"}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-slate-600 text-sm">
              <ul className="list-disc space-y-0.5 pl-5">
                {describeReasons(reuse, applicationDeadline).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <p>
                {consequence(reuse)} Duplicating gives you a fresh draft with
                everything carried over except the dates.
              </p>
              <p className="text-slate-500">
                Only fixing a mistake in this vacancy? Keep editing.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel
            className="border-slate-200 bg-white text-slate-700"
            disabled={isDuplicating}
            onClick={onAcknowledge}
          >
            {intent === "publish"
              ? "Publish this one anyway"
              : "Keep editing this one"}
          </AlertDialogCancel>
          <DuplicateButton
            isDuplicating={isDuplicating}
            onDuplicate={onDuplicate}
          />
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Shown once, right after a duplicate lands in the studio. */
export function FreshDuplicateBanner({
  onDismiss,
  onGoToDates,
}: {
  onDismiss: () => void;
  onGoToDates: () => void;
}) {
  return (
    <div
      className="mb-6 flex items-start gap-3 rounded-xl border border-[#3DA9E0]/40 bg-[#3DA9E0]/10 p-4 text-sm"
      role="status"
    >
      <CalendarDays className="mt-0.5 shrink-0 text-[#3DA9E0]" size={18} />
      <div className="flex-1 text-[#001731]">
        <p className="font-medium">This is a new draft copy.</p>
        <p className="mt-1 text-slate-600">
          The description, screening, questions and interview rounds came
          across. Set a new application deadline and start date, check the term
          and title, then publish.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <button
            className="inline-flex items-center gap-2 rounded-lg bg-[#001731] px-3 py-1.5 font-medium text-white text-xs"
            onClick={onGoToDates}
            type="button"
          >
            <CalendarDays size={13} />
            Set dates
          </button>
          <button
            className="px-2 py-1.5 font-medium text-slate-600 text-xs hover:text-[#001731]"
            onClick={onDismiss}
            type="button"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
