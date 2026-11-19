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
import { useState } from "react";
import { STUDIO } from "../../../_components/studio";
import type { ProjectOption } from "../edit-options";

export interface ProjectPickerLabels {
  /** Accessible name of the trigger. */
  label: string;
  none: string;
  noneChosen: string;
  noProjectFound: string;
  others: string;
  search: string;
  suggested: string;
}

/** Searchable list of Finago projects: the department's first, then the rest, then "None". */
export function ProjectPicker({
  currentName,
  labels,
  onChange,
  options,
  value,
}: {
  /** Shown while the chosen project is not on the active list. */
  currentName: string | null;
  labels: ProjectPickerLabels;
  onChange: (projectId: string | null) => void;
  options: ProjectOption[];
  value: string | null;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.projectId === value);
  let text = labels.noneChosen;
  if (value !== null) {
    text = selected?.name ?? currentName ?? value;
  }
  const suggested = options.filter((option) => option.suggested);
  const others = options.filter((option) => !option.suggested);

  const item = (option: ProjectOption) => (
    <CommandItem
      key={option.projectId}
      onSelect={() => {
        onChange(option.projectId);
        setOpen(false);
      }}
      value={option.name}
    >
      {option.name}
    </CommandItem>
  );

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <button
          aria-label={labels.label}
          style={{
            background: STUDIO.white,
            border: `0.5px solid ${STUDIO.rule2}`,
            borderRadius: 8,
            color: STUDIO.ink,
            fontSize: 14,
            padding: "8px 12px",
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
          <CommandInput placeholder={labels.search} />
          <CommandList>
            <CommandEmpty>{labels.noProjectFound}</CommandEmpty>
            {suggested.length > 0 && (
              <CommandGroup heading={labels.suggested}>
                {suggested.map(item)}
              </CommandGroup>
            )}
            {others.length > 0 && (
              <CommandGroup heading={suggested.length > 0 ? labels.others : ""}>
                {others.map(item)}
              </CommandGroup>
            )}
            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  onChange(null);
                  setOpen(false);
                }}
                value={labels.none}
              >
                {labels.none}
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
