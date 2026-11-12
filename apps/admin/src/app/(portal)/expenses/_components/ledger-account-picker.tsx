"use client";

import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@repo/ui/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/ui/popover";
import { useState } from "react";
import { STUDIO } from "../../_components/studio";

export interface LedgerAccountOption {
  accountNumber: number;
  name: string;
}

export interface LedgerAccountPickerLabels {
  /** Accessible name of the trigger. */
  account: string;
  /** Trigger text while nothing is chosen. */
  chooseAccount: string;
  noAccountFound: string;
  searchAccount: string;
}

/** Searchable list of ledger accounts, by number or name. */
export function LedgerAccountPicker({
  accounts,
  labels,
  onChange,
  size = "compact",
  value,
}: {
  accounts: LedgerAccountOption[];
  labels: LedgerAccountPickerLabels;
  onChange: (accountNumber: number) => void;
  /** `field` matches the dialog inputs (`px-3 py-2 text-[14px]`). */
  size?: "compact" | "field";
  value: number | null;
}) {
  const [open, setOpen] = useState(false);
  const selected = accounts.find((option) => option.accountNumber === value);
  const text = selected
    ? `${selected.accountNumber} ${selected.name}`
    : (value?.toString() ?? labels.chooseAccount);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <button
          aria-label={labels.account}
          style={{
            background: STUDIO.white,
            border: `0.5px solid ${STUDIO.rule2}`,
            borderRadius: 8,
            color: STUDIO.ink,
            fontSize: size === "field" ? 14 : 13,
            padding: size === "field" ? "8px 12px" : "6px 10px",
            textAlign: "left",
            width: "100%",
          }}
          type="button"
        >
          {text}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <Command>
          <CommandInput placeholder={labels.searchAccount} />
          <CommandList>
            <CommandEmpty>{labels.noAccountFound}</CommandEmpty>
            {accounts.map((option) => (
              <CommandItem
                key={option.accountNumber}
                onSelect={() => {
                  onChange(option.accountNumber);
                  setOpen(false);
                }}
                value={`${option.accountNumber} ${option.name}`}
              >
                {option.accountNumber} {option.name}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
