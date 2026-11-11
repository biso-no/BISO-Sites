"use client";

import { cn } from "@repo/ui/lib/utils";
import { CalendarCheck, CalendarDays, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";
import {
  findNearbyDepartmentEvents,
  type NearbyEvent,
} from "@/lib/actions/expense-events-match";
import { receiptDateList } from "@/lib/expense-event-window";
import { focusRingClass, secondaryActionClass } from "./form-styles";
import type { Receipt } from "./store";

const EVENT_MATCH_DEBOUNCE_MS = 500;
/** The `eventName` column's size on the expense. */
export const EVENT_NAME_MAX = 100;

/**
 * The nearest published event of the department around the receipt dates,
 * looked up (debounced) whenever the dates or the department change. "No"
 * hides the suggestion for the rest of this visit.
 */
export function useNearbyEvent(departmentId: string, receipts: Receipt[]) {
  const [found, setFound] = useState<{ events: NearbyEvent[]; key: string }>({
    events: [],
    key: "",
  });
  const [dismissed, setDismissed] = useState(false);
  const dates = receiptDateList(
    receipts
      .filter((receipt) => receipt.status === "ready")
      .map((receipt) => receipt.date)
  ).join(",");
  const key = departmentId && dates ? `${departmentId}|${dates}` : "";

  useEffect(() => {
    if (!(departmentId && dates)) {
      return;
    }
    let current = true;
    const timer = setTimeout(async () => {
      let events: NearbyEvent[] = [];
      try {
        const result = await findNearbyDepartmentEvents({
          departmentId,
          dates: dates.split(","),
        });
        events = result.success ? (result.data ?? []) : [];
      } catch {
        // The suggestion is optional: a failed lookup just shows none.
      }
      if (current) {
        setFound({ events, key: `${departmentId}|${dates}` });
      }
    }, EVENT_MATCH_DEBOUNCE_MS);

    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [departmentId, dates]);

  // Only answers for the current dates and department count, so a suggestion
  // for the previous department never lingers while the next lookup runs.
  const suggestion =
    !dismissed && key && found.key === key ? (found.events[0] ?? null) : null;

  return { dismiss: () => setDismissed(true), suggestion };
}

interface EventMatchProps {
  eventName: string;
  onAccept: (event: NearbyEvent) => void;
  onDismiss: () => void;
  onRemove: () => void;
  suggestion: NearbyEvent | null;
}

/** "Was this for {event}?" with Yes/No, or the chosen event as a removable tag. */
export function EventMatch({
  eventName,
  onAccept,
  onDismiss,
  onRemove,
  suggestion,
}: EventMatchProps) {
  const t = useTranslations("expenses.composer.report");
  const questionId = useId();
  const name = eventName.trim();

  if (name) {
    return (
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="type-label text-ink-muted">{t("eventLabel")}</span>
        <span className="type-body-sm inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-biso-pill border border-edge bg-surface py-1 pr-1.5 pl-3 font-semibold text-ink">
          <CalendarCheck
            aria-hidden="true"
            className="size-3.5 shrink-0 text-ink-accent"
          />
          <span className="min-w-0 truncate">{name}</span>
          <button
            aria-label={t("removeEvent", { event: name })}
            className={cn(
              "shrink-0 rounded-biso-pill p-1 text-ink-muted transition-colors hover:bg-ink-muted/8 hover:text-ink",
              focusRingClass
            )}
            onClick={onRemove}
            type="button"
          >
            <X aria-hidden="true" className="size-3" />
          </button>
        </span>
      </div>
    );
  }

  if (!suggestion) {
    return null;
  }

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-biso-md border border-edge bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
      <p
        className="type-body-sm flex min-w-0 items-start gap-2 text-ink"
        id={questionId}
      >
        <CalendarDays
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 text-ink-accent"
        />
        <span className="min-w-0 break-words">
          {t("eventQuestion", { event: suggestion.title })}
        </span>
      </p>
      <div className="flex shrink-0 gap-2">
        <button
          aria-describedby={questionId}
          className={cn(secondaryActionClass, "bg-surface px-4 py-2")}
          onClick={() => onAccept(suggestion)}
          type="button"
        >
          {t("eventYes")}
        </button>
        <button
          aria-describedby={questionId}
          className={cn(secondaryActionClass, "bg-surface px-4 py-2")}
          onClick={onDismiss}
          type="button"
        >
          {t("eventNo")}
        </button>
      </div>
    </div>
  );
}
