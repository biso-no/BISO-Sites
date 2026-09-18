"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import type { LucideIcon } from "lucide-react";
import { MoreHorizontal } from "lucide-react";
import Link from "next/link";

export interface OverflowEntry {
  href: string;
  icon?: LucideIcon;
  key: string;
  label: string;
}

const TRIGGER_CLASS =
  "flex shrink-0 items-center rounded-lg p-2 text-white transition-colors hover:text-brand";

/**
 * Non-interactive twin of the trigger for the measurement ghost. The overflow
 * menu only exists once something is hidden, so its own width has to be known
 * before it is rendered — otherwise the last item that fits would be kept, the
 * trigger would then appear beside it, and the row would overflow by exactly
 * the width of the trigger.
 */
export function NavOverflowTriggerGhost() {
  return (
    <span className={TRIGGER_CLASS}>
      <MoreHorizontal aria-hidden className="h-5 w-5" />
    </span>
  );
}

interface NavOverflowMenuProps {
  /** Items that did not fit the row, in row order. */
  entries: readonly OverflowEntry[];
  label: string;
}

/**
 * Holds whatever {@link useNavOverflow} could not fit in the desktop row. It is
 * rendered only when something is actually hidden, so a wide viewport never
 * shows a "…" that opens an empty menu.
 */
export function NavOverflowMenu({ entries, label }: NavOverflowMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button aria-label={label} className={TRIGGER_CLASS} type="button">
          <MoreHorizontal aria-hidden className="h-5 w-5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {entries.map((entry) => (
          <DropdownMenuItem asChild key={entry.key}>
            <Link href={entry.href}>
              {entry.icon && (
                <entry.icon aria-hidden className="mr-2 h-4 w-4 opacity-80" />
              )}
              {entry.label}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
