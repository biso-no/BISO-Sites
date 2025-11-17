"use client";

import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { Locale } from "@repo/api/types/appwrite";
import { CheckCircle2, XCircle } from "lucide-react";

const LOCALE_LABELS: Record<Locale, string> = {
  [Locale.NO]: "Norwegian",
  [Locale.EN]: "English",
};

interface LocaleSwitcherProps {
  locales: Locale[];
  activeLocale: Locale;
  onLocaleChange: (locale: Locale) => void;
  inSync: boolean;
  publishedStatus?: Record<Locale, boolean>;
  dirtyStatus?: Record<Locale, boolean>;
}

export function LocaleSwitcher({
  locales,
  activeLocale,
  onLocaleChange,
  inSync,
  publishedStatus = {},
  dirtyStatus = {},
}: LocaleSwitcherProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        {locales.map((locale) => {
          const isActive = locale === activeLocale;
          const isPublished = publishedStatus[locale];
          const isDirty = dirtyStatus[locale];

          return (
            <Button
              key={locale}
              type="button"
              size="sm"
              variant={isActive ? "default" : "outline"}
              className={cn(
                "relative flex items-center gap-2",
                isActive ? "bg-primary text-primary-foreground" : "text-foreground"
              )}
              onClick={() => onLocaleChange(locale)}
            >
              <span>{LOCALE_LABELS[locale]}</span>
              {isDirty && (
                <span className="h-2 w-2 rounded-full bg-orange-500" title="Unsaved changes" />
              )}
              {isPublished && !isDirty && (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                    isActive
                      ? "bg-white/80 text-primary-90 dark:bg-primary-foreground/20 dark:text-primary-foreground"
                      : "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
                  )}
                >
                  Live
                </span>
              )}
            </Button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 border-l border-border pl-3">
        {inSync ? (
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            <span>In sync</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-orange-600 dark:text-orange-400">
            <XCircle className="h-4 w-4" />
            <span>Out of sync</span>
          </div>
        )}
      </div>
    </div>
  );
}

