"use client";

import { type TextSwatch, textSwatches } from "@repo/shared/utils/text-colours";
import { useMemo } from "react";
import { useEditorCallbacks } from "@/editor/callbacks";
import { effectiveTheme } from "@/editor/effective-theme";
import { useMeta } from "@/editor/hooks";
import { useEditorStore } from "@/editor/store";

/**
 * The colour swatches of the page being edited: its theme as the canvas
 * paints it, the Theme panel's live preview first. Here, in the lazily
 * loaded field, so the editor store stays out of the public bundle.
 */
export function usePageSwatches(): TextSwatch[] {
  const meta = useMeta();
  const { departments } = useEditorCallbacks();
  const themePreview = useEditorStore((s) => s.themePreview);
  const theme = themePreview ?? effectiveTheme(meta, departments);
  return useMemo(() => textSwatches(theme), [theme]);
}
