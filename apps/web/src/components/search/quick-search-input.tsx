"use client";

import { SEARCH_QUERY_MAX } from "@repo/shared/search/params";
import { cn } from "@repo/ui/lib/utils";
import { useTranslations } from "next-intl";
import type { KeyboardEvent, Ref } from "react";
import { optionDomId } from "./quick-options";

export interface QuickSearchInputProps {
  activeId: string | null;
  /** Size and spacing for the row it sits in; the query is set in Museo Slab. */
  className?: string;
  /** True while the listbox has options to move through. */
  expanded: boolean;
  inputRef: Ref<HTMLInputElement>;
  listboxId: string;
  onChange: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  value: string;
}

/**
 * The search field as an ARIA combobox: focus stays here while the arrow keys
 * move `aria-activedescendant` through the listbox. A plain text input, not
 * `type="search"`, so Escape closes the search instead of clearing the field.
 * Draws no focus ring of its own; the row around it shows focus.
 */
export function QuickSearchInput({
  activeId,
  className,
  expanded,
  inputRef,
  listboxId,
  onChange,
  onKeyDown,
  value,
}: QuickSearchInputProps) {
  const t = useTranslations("search");
  return (
    <input
      aria-activedescendant={
        activeId ? optionDomId(listboxId, activeId) : undefined
      }
      aria-autocomplete="list"
      aria-controls={listboxId}
      aria-expanded={expanded}
      aria-label={t("field.label")}
      autoCapitalize="off"
      autoComplete="off"
      autoCorrect="off"
      className={cn(
        "min-w-0 flex-1 bg-transparent font-black font-display text-ink text-xl caret-action placeholder:font-normal placeholder:font-sans placeholder:text-ink-muted focus:outline-none",
        className
      )}
      enterKeyHint="search"
      inputMode="search"
      maxLength={SEARCH_QUERY_MAX}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={onKeyDown}
      placeholder={t("field.placeholder")}
      ref={inputRef}
      role="combobox"
      spellCheck={false}
      type="text"
      value={value}
    />
  );
}
