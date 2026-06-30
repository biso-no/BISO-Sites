"use client";

import { Button } from "@repo/ui/components/ui/button";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import type { TourLabels, TourStep } from "../types";

interface TourStepCardBodyProps {
  bodyId: string;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  labels: TourLabels;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
  step: TourStep;
  titleId: string;
  total: number;
  translate?: (key: string) => string;
}

/**
 * The inner content of a tour step — shared by the anchored (popover) and
 * centered (modal) presentations. Styled with `@repo/ui` primitives + Tailwind
 * tokens so it inherits whichever host app's design language is loaded.
 */
export function TourStepCardBody({
  step,
  index,
  total,
  titleId,
  bodyId,
  labels,
  isFirst,
  isLast,
  translate,
  onNext,
  onBack,
  onSkip,
}: TourStepCardBodyProps) {
  const resolve = (value: string) => (translate ? translate(value) : value);
  const current = index + 1;

  return (
    <div
      aria-describedby={bodyId}
      aria-labelledby={titleId}
      aria-modal="false"
      className="flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-3 rounded-lg border bg-popover p-4 text-popover-foreground shadow-md"
      role="dialog"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground text-xs">
          {labels.progress(current, total)}
        </span>
        <button
          aria-label={labels.close}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onClick={onSkip}
          type="button"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>

      <div className="space-y-1.5">
        <h2 className="font-semibold text-foreground text-sm" id={titleId}>
          {resolve(step.title)}
        </h2>
        <p
          className="text-muted-foreground text-sm leading-relaxed"
          id={bodyId}
        >
          {resolve(step.body)}
        </p>
      </div>

      <span aria-live="polite" className="sr-only">
        {`${labels.progress(current, total)}: ${resolve(step.title)}`}
      </span>

      <div className="mt-1 flex items-center justify-between gap-2">
        <Button onClick={onSkip} size="sm" variant="ghost">
          {labels.skip}
        </Button>
        <div className="flex items-center gap-2">
          {isFirst ? null : (
            <Button
              className="gap-1.5"
              onClick={onBack}
              size="sm"
              variant="outline"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              {labels.back}
            </Button>
          )}
          <Button className="gap-1.5" onClick={onNext} size="sm">
            {isLast ? labels.finish : labels.next}
            {isLast ? (
              <Check aria-hidden="true" className="size-4" />
            ) : (
              <ArrowRight aria-hidden="true" className="size-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
