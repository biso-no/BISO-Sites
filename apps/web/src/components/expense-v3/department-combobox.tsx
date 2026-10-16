"use client";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@repo/ui/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/ui/popover";
import { cn } from "@repo/ui/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { selectContentClass, selectTriggerClass } from "./form-styles";

interface DepartmentComboboxProps {
  defaultValue?: string;
  disabled?: boolean;
  /** Lets a `<label htmlFor>` name the trigger. */
  id?: string;
  items: { value: string; label: string }[];
  name: string;
  onValueChange?: (value: string) => void;
}

/**
 * The searchable department picker.
 *
 * Behaves exactly like `@repo/ui`'s `Combobox`, which it replaces here: an
 * uncontrolled value seeded from `defaultValue`, a hidden input carrying it
 * under `name`, and `onValueChange` on every pick. That component takes no
 * class names, labels or ids, so its trigger could not be skinned with the
 * design system's tokens, named by a `<label>`, or say anything but English.
 */
export function DepartmentCombobox({
  defaultValue,
  disabled,
  id,
  items,
  name,
  onValueChange,
}: DepartmentComboboxProps) {
  const t = useTranslations("expenses.composer.department");
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(defaultValue || "");

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          aria-expanded={open}
          className={cn(
            selectTriggerClass,
            "type-body-sm flex h-10 items-center justify-between gap-2 border px-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-solid focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            !value && "text-ink-muted"
          )}
          id={id}
          role="combobox"
          type="button"
        >
          <span className="min-w-0 truncate">
            {value
              ? items.find((item) => item.value === value)?.label
              : t("placeholder")}
          </span>
          <ChevronsUpDown
            aria-hidden="true"
            className="size-4 shrink-0 text-ink-muted"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(
          selectContentClass,
          "w-(--radix-popover-trigger-width) min-w-64 p-0"
        )}
      >
        <Command className="bg-surface-raised text-ink">
          <CommandInput
            className="placeholder:text-ink-muted"
            placeholder={t("search")}
          />
          <CommandList>
            <CommandEmpty className="type-body-sm py-6 text-center text-ink-muted">
              {t("empty")}
            </CommandEmpty>
            <CommandGroup className="text-ink">
              {items.map((item) => (
                <CommandItem
                  className="type-body-sm data-[selected=true]:bg-surface-sunken data-[selected=true]:text-ink"
                  key={item.value}
                  onSelect={() => {
                    setValue(item.value);
                    setOpen(false);
                    onValueChange?.(item.value);
                  }}
                >
                  <Check
                    aria-hidden="true"
                    className={cn(
                      "mr-2 size-4 text-ink-accent",
                      value === item.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
      <input name={name} type="hidden" value={value} />
    </Popover>
  );
}
