"use client";

import { Button } from "@repo/ui/components/ui/button";
import { RefreshCcw, Save, Send } from "lucide-react";
import { LocaleSwitcher } from "./locale-switcher";
import type { Locale } from "@repo/api/types/appwrite";

interface EditorHeaderProps {
  locales: Locale[];
  activeLocale: Locale;
  onLocaleChange: (locale: Locale) => void;
  inSync: boolean;
  publishedStatus: Record<Locale, boolean>;
  dirtyStatus: Record<Locale, boolean>;
  onSave: () => void;
  onPublish: () => void;
  onRevert: () => void;
  saving?: boolean;
  publishing?: boolean;
  canSave?: boolean;
  canPublish?: boolean;
}

export function EditorHeader({
  locales,
  activeLocale,
  onLocaleChange,
  inSync,
  publishedStatus,
  dirtyStatus,
  onSave,
  onPublish,
  onRevert,
  saving = false,
  publishing = false,
  canSave = true,
  canPublish = true,
}: EditorHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-border bg-background px-4 py-3">
      <LocaleSwitcher
        locales={locales}
        activeLocale={activeLocale}
        onLocaleChange={onLocaleChange}
        inSync={inSync}
        publishedStatus={publishedStatus}
        dirtyStatus={dirtyStatus}
      />

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onRevert}
          disabled={saving || publishing || !dirtyStatus[activeLocale]}
        >
          <RefreshCcw className="mr-2 h-4 w-4" />
          Revert
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onSave}
          disabled={!canSave || saving || publishing}
        >
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Save draft"}
        </Button>
        <Button
          size="sm"
          onClick={onPublish}
          disabled={!canPublish || saving || publishing}
        >
          <Send className="mr-2 h-4 w-4" />
          {publishing ? "Publishing..." : "Publish"}
        </Button>
      </div>
    </div>
  );
}

