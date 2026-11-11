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
const NAV_KEYS = new Set(["ArrowDown", "ArrowUp", "Home", "End"]);
/** The API caps a type text at this length. */
const MAX_TEXT_LENGTH = 120;

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
    if (!navigated.current && target && highlight !== target) {
      setHighlight(target);
    }
  });

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    navigated.current = false;
    autoTarget.current = undefined;
    setQuery("");
    setHighlight(next ? (value.costType ?? "") : "");
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
            if (NAV_KEYS.has(event.key)) {
              navigated.current = true;
            }
          }}
          onValueChange={setHighlight}
          shouldFilter={false}
          value={highlight}
        >
          <CommandInput
            aria-label={t("searchLabel")}
            className="placeholder:text-ink-muted"
            maxLength={MAX_TEXT_LENGTH}
            onValueChange={handleQuery}
            placeholder={t("search")}
            value={query}
          />
          <CommandList
            aria-label={t("searchLabel")}
            onPointerMoveCapture={() => {
              navigated.current = true;
            }}
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
