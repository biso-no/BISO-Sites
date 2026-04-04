"use client";

import { cn } from "@/lib/utils";

export type Locale = "en" | "no";

type LocaleStatus = "complete" | "partial" | "empty";

type LocaleTabGroupProps = {
  activeLocale: Locale;
  onChange: (locale: Locale) => void;
  /** Pass the status per locale so the tab can show a completion dot */
  status?: Record<Locale, LocaleStatus>;
  className?: string;
};

const FLAG: Record<Locale, string> = { en: "🇬🇧", no: "🇳🇴" };
const LABEL: Record<Locale, string> = { en: "English", no: "Norwegian" };

const STATUS_DOT: Record<LocaleStatus, string> = {
  complete: "bg-emerald-500",
  partial: "bg-amber-400",
  empty: "bg-muted-foreground/30",
};

export function LocaleTabGroup({
  activeLocale,
  onChange,
  status,
  className,
}: LocaleTabGroupProps) {
  const locales: Locale[] = ["en", "no"];

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border border-border/60 bg-muted/40 p-1",
        className,
      )}
      role="tablist"
      aria-label="Content language"
    >
      {locales.map((locale) => {
        const active = locale === activeLocale;
        const dot = status?.[locale];

        return (
          <button
            key={locale}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(locale)}
            className={cn(
              "relative flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span>{FLAG[locale]}</span>
            <span>{LABEL[locale]}</span>
            {dot && (
              <span
                className={cn(
                  "ml-0.5 h-1.5 w-1.5 rounded-full",
                  STATUS_DOT[dot],
                )}
                aria-hidden
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
