"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Switch } from "@repo/ui/components/ui/switch";
import { cn } from "@repo/ui/lib/utils";
import {
  type ContentLocale,
  getAutoTranslationDescription,
  getTranslationActionLabel,
  type TranslationOperation,
} from "@/lib/content-translation";

interface AutoTranslateControlProps {
  checked: boolean;
  className?: string;
  compact?: boolean;
  /** Replaces the default English explanation, e.g. with localised copy. */
  description?: string;
  disabled?: boolean;
  /** Replaces the default "Auto-translate" label. */
  label?: string;
  onCheckedChange: (checked: boolean) => void;
  operation: TranslationOperation;
  sourceLocale: ContentLocale;
}

export const AutoTranslateControl = ({
  checked,
  className,
  compact = false,
  description,
  disabled,
  label = "Auto-translate",
  onCheckedChange,
  operation,
  sourceLocale,
}: AutoTranslateControlProps) => {
  const explanation =
    description ?? getAutoTranslationDescription(sourceLocale, operation);
  return (
    <div
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-xl border border-border/70 bg-background/80 px-3 py-2",
        compact && "rounded-none border-0 bg-transparent p-0",
        disabled && "cursor-not-allowed opacity-60",
        className
      )}
      title={explanation}
    >
      <span className="min-w-0 text-left">
        <span className="block font-medium text-foreground text-sm">
          {label}
        </span>
        <span
          className={cn(
            "block text-muted-foreground text-xs",
            compact && "sr-only"
          )}
        >
          {explanation}
        </span>
      </span>
      <Switch
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
};

interface TranslationReviewCardProps {
  className?: string;
  disabled?: boolean;
  isTranslating: boolean;
  onTranslate: () => void;
  sourceLocale: ContentLocale;
}

export const TranslationReviewCard = ({
  className,
  disabled,
  isTranslating,
  onTranslate,
  sourceLocale,
}: TranslationReviewCardProps) => (
  <section
    className={cn(
      "rounded-2xl border border-border/70 bg-muted/20 p-5",
      className
    )}
  >
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h3 className="font-semibold text-foreground">AI translation</h3>
        <p className="mt-1 max-w-2xl text-muted-foreground text-sm">
          Generate the other language from the active locale, then review it
          before saving or publishing.
        </p>
      </div>
      <Button
        disabled={disabled || isTranslating}
        onClick={onTranslate}
        type="button"
        variant="outline"
      >
        {isTranslating
          ? "Translating…"
          : getTranslationActionLabel(sourceLocale)}
      </Button>
    </div>
  </section>
);
