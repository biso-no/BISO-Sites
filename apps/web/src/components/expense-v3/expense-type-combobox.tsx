"use client";

import { costTypeLabel } from "@repo/shared/utils/expense-cost-types";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@repo/ui/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/ui/popover";
import { cn } from "@repo/ui/lib/utils";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { selectContentClass, selectTriggerClass } from "./form-styles";
import type { TypeState } from "./receipt-types";
import { filterTypeOptions } from "./type-search";
import type { ExpenseTypeOption } from "./types";

const OWN_TEXT_VALUE = "__own-text__";
const VIM_KEYS = "njpk";

/** cmdk also moves the highlight on Ctrl+N/J/P/K. */
function isVimNavigation(event: { ctrlKey: boolean; key: string }): boolean {
  return event.ctrlKey && VIM_KEYS.includes(event.key.toLowerCase());
}
const NAV_KEYS = new Set(["ArrowDown", "ArrowUp", "Home", "End"]);
/** The API caps a type text at this length. */
const MAX_TEXT_LENGTH = 120;

/**
 * cmdk scrolls the list only for its own key moves, so a row the picker
 * steers to, such as "Use “…”" under a long list of matches, is brought into
 * view here. Not every environment has `scrollIntoView`.
 */
function revealItem(list: HTMLElement | null, value: string) {
  const item = [
    ...(list?.querySelectorAll<HTMLElement>("[cmdk-item]") ?? []),
  ].find((element) => element.getAttribute("data-value") === value);
  if (typeof item?.scrollIntoView === "function") {
    item.scrollIntoView({ block: "nearest" });
  }
}

interface ExpenseTypeComboboxProps {
  ariaLabel?: string;
  /** A smaller trigger for the overview row. */
  compact?: boolean;
  disabled?: boolean;
  id?: string;
  locale: string;
  onChange: (next: { costType: string } | { costTypeText: string }) => void;
  options: ExpenseTypeOption[];
  state: TypeState | undefined;
  value: { costType?: string; costTypeText?: string };
}

function ownTextLabel(
  text: string | undefined,
  t: (key: "ownQuoted" | "choose", values?: { text: string }) => string
): string {
  return text ? t("ownQuoted", { text }) : t("choose");
}

/**
 * The searchable expense-type picker. When no type fits, the student keeps
 * their own text through a separate "Use “…”" item (or Enter).
 */
export function ExpenseTypeCombobox({
  ariaLabel,
  compact,
  disabled,
  id,
  locale,
  onChange,
  options,
  state,
  value,
}: ExpenseTypeComboboxProps) {
  const t = useTranslations("expenses.composer.typePicker");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState("");
  // Once the student moves through the list, cmdk's own highlight rules apply.
  const navigated = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);

  const { matches, offerOwnText } = useMemo(
    () => filterTypeOptions(query, options, locale),
    [query, options, locale]
  );
  const ownText = query.trim();

  const chosen = value.costType
    ? options.find((option) => option.slug === value.costType)
    : undefined;
  const label = chosen ? costTypeLabel(chosen, locale) : undefined;
  const needsChoice =
    state === "needs_choice" && !(label || value.costTypeText);

  // Enter picks the exact-name type, else the student's own text, until they
  // navigate. Held in a ref: cmdk reports its first-item highlight before this
  // component re-renders with the new query.
  const autoTarget = useRef<string | undefined>(undefined);

  const handleQuery = (next: string) => {
    navigated.current = false;
    const result = filterTypeOptions(next, options, locale);
    if (result.exact) {
      autoTarget.current = result.exact.slug;
    } else {
      autoTarget.current = result.offerOwnText ? OWN_TEXT_VALUE : undefined;
    }
    setQuery(next);
  };

  // cmdk re-highlights the first row on every search change; steer it back to
  // the row Enter should pick until the student navigates. `highlight` mirrors
  // cmdk's own value, so this change always reaches it.
  useEffect(() => {
    const target = autoTarget.current;
    if (navigated.current || !target) {
      return;
    }
    if (highlight === target) {
      revealItem(listRef.current, target);
    } else {
      setHighlight(target);
    }
  });

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    // Reopened on the student's own text, the search starts from it, so Enter
    // keeps it and a small change is a few keys away.
    const ownTextSeed =
      next && !value.costType ? (value.costTypeText?.trim() ?? "") : "";
    handleQuery(ownTextSeed);
    setHighlight(next ? (autoTarget.current ?? value.costType ?? "") : "");
  };

  const pick = (next: { costType: string } | { costTypeText: string }) => {
    onChange(next);
    handleOpenChange(false);
  };

  const hasValue = Boolean(label || value.costTypeText);
  const triggerText = label ?? ownTextLabel(value.costTypeText, t);

  return (
    <Popover onOpenChange={handleOpenChange} open={open}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-invalid={needsChoice || undefined}
          className={cn(
            selectTriggerClass,
            "type-body-sm flex items-center justify-between gap-2 border px-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-solid focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            compact ? "h-8 px-2" : "h-10",
            needsChoice &&
              "border-warning bg-warning/10 font-semibold text-ink",
            !(needsChoice || hasValue) && "text-ink-muted"
          )}
          id={id}
          type="button"
        >
          <span className="flex min-w-0 items-center gap-2">
            {ariaLabel ? (
              <span className="sr-only">{`${ariaLabel}: `}</span>
            ) : null}
            <span className="min-w-0 truncate">{triggerText}</span>
            {state === "ai" && label ? (
              <span className="shrink-0 rounded-biso-sm border border-edge bg-surface-sunken px-1 font-bold text-[10px] text-ink-accent">
                <span aria-hidden="true">AI</span>
                <span className="sr-only">{t("aiPicked")}</span>
              </span>
            ) : null}
          </span>
          <ChevronsUpDown
            aria-hidden="true"
            className="size-4 shrink-0 text-ink-muted"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        aria-label={t("searchLabel")}
        className={cn(
          selectContentClass,
          "w-(--radix-popover-trigger-width) min-w-64 p-0"
        )}
      >
        <Command
          className="bg-surface-raised text-ink"
          label={t("searchLabel")}
          loop
          onKeyDown={(event) => {
            if (NAV_KEYS.has(event.key) || isVimNavigation(event)) {
              navigated.current = true;
            }
          }}
          onValueChange={setHighlight}
          shouldFilter={false}
          value={highlight}
        >
          {/* 16px on phones: iOS zooms into a smaller input on focus. */}
          <CommandInput
            aria-label={t("searchLabel")}
            className="text-base placeholder:text-ink-muted md:text-sm"
            maxLength={MAX_TEXT_LENGTH}
            onValueChange={handleQuery}
            placeholder={t("search")}
            value={query}
          />
          <CommandList
            label={t("searchLabel")}
            onPointerMoveCapture={() => {
              navigated.current = true;
            }}
            ref={listRef}
          >
            {matches.length === 0 && !offerOwnText ? (
              <CommandEmpty className="type-body-sm py-6 text-center text-ink-muted">
                {t("empty")}
              </CommandEmpty>
            ) : null}
            {matches.length > 0 ? (
              <CommandGroup className="text-ink">
                {matches.map((option) => (
                  <CommandItem
                    className="type-body-sm data-[selected=true]:bg-surface-sunken data-[selected=true]:text-ink"
                    key={option.slug}
                    onSelect={() => pick({ costType: option.slug })}
                    value={option.slug}
                  >
                    <Check
                      aria-hidden="true"
                      className={cn(
                        "mr-2 size-4 text-ink-accent",
                        value.costType === option.slug
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                    {costTypeLabel(option, locale)}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {offerOwnText ? (
              <>
                {matches.length > 0 ? (
                  <CommandSeparator className="bg-edge" />
                ) : null}
                <CommandGroup className="text-ink">
                  <CommandItem
                    className="type-body-sm text-ink-accent italic data-[selected=true]:bg-surface-sunken data-[selected=true]:text-ink-accent"
                    onSelect={() => pick({ costTypeText: ownText })}
                    value={OWN_TEXT_VALUE}
                  >
                    <Plus
                      aria-hidden="true"
                      className="mr-2 size-4 text-ink-accent"
                    />
                    {t("useOwn", { text: ownText })}
                  </CommandItem>
                </CommandGroup>
              </>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
