"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Button } from "@repo/ui/components/ui/button";
import { Badge } from "@repo/ui/components/ui/badge";
import { Globe, Languages, Loader2, SkipForward } from "lucide-react";
import type { Locale } from "@repo/api/types/appwrite";

export type UntranslatedLocaleInfo = {
  locale: Locale;
  missingFields: string[];
  blockCount: number;
  filledBlockCount: number;
};

type TranslationProgress = Record<
  string,
  "pending" | "translating" | "done" | "error"
>;

type TranslationCheckModalProps = {
  open: boolean;
  untranslatedLocales: UntranslatedLocaleInfo[];
  onTranslateAndPublish: () => void;
  onSkipAndPublish: () => void;
  onCancel: () => void;
  isTranslating: boolean;
  translationProgress: TranslationProgress;
};

const LOCALE_LABELS: Record<string, string> = {
  no: "Norwegian",
  en: "English",
};

function localeLabel(l: Locale): string {
  return LOCALE_LABELS[l] ?? l.toUpperCase();
}

export function TranslationCheckModal({
  open,
  untranslatedLocales,
  onTranslateAndPublish,
  onSkipAndPublish,
  onCancel,
  isTranslating,
  translationProgress,
}: TranslationCheckModalProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && !isTranslating && onCancel()}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Untranslated Content Detected
          </DialogTitle>
          <DialogDescription>
            The following locales have missing or empty content. You can
            auto-translate them before publishing, or publish as-is.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {untranslatedLocales.map((info) => {
            const progress = translationProgress[info.locale];
            return (
              <div key={info.locale} className="rounded-md border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {localeLabel(info.locale)}
                  </span>
                  <Badge variant="secondary">
                    {info.filledBlockCount}/{info.blockCount} blocks filled
                  </Badge>
                </div>

                {info.missingFields.length > 0 && (
                  <p className="mt-1 text-muted-foreground">
                    Missing: {info.missingFields.slice(0, 4).join(", ")}
                    {info.missingFields.length > 4 &&
                      ` +${info.missingFields.length - 4} more`}
                  </p>
                )}

                {isTranslating && progress && (
                  <div className="mt-2">
                    {progress === "translating" && (
                      <span className="flex items-center gap-1 text-xs text-primary">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Translating…
                      </span>
                    )}
                    {progress === "done" && (
                      <span className="text-xs text-green-600">
                        Translation complete
                      </span>
                    )}
                    {progress === "error" && (
                      <span className="text-xs text-destructive">
                        Translation failed — will publish original content
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onCancel} disabled={isTranslating}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={onSkipAndPublish}
            disabled={isTranslating}
          >
            <SkipForward className="mr-2 h-4 w-4" />
            Publish Without Translating
          </Button>
          <Button onClick={onTranslateAndPublish} disabled={isTranslating}>
            {isTranslating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Languages className="mr-2 h-4 w-4" />
            )}
            Translate &amp; Publish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
