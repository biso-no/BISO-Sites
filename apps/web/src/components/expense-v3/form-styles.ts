import { cn } from "@repo/ui/lib/utils";
import {
  statusPanelPrimaryAction,
  statusPanelSecondaryAction,
} from "@/components/ui/status-panel";

/**
 * The design system's skin for the expense composer's controls.
 *
 * The same treatment `shop/v2/form-styles.ts` gives the shop: the `@repo/ui`
 * controls read shadcn's semantic palette, which turns neutral grey beside the
 * navy the redesign's aliases resolve to in dark mode, so every field here
 * passes these instead. `cn`/tailwind-merge in each control lets a later class
 * replace the base one it conflicts with, so these override rather than stack.
 */
export const fieldClass =
  "rounded-biso-sm border-edge bg-surface text-ink shadow-none placeholder:text-ink-muted hover:border-ink-muted focus:border-ink-accent focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

/** Select and combobox triggers: the field's surface, at the field's height. */
export const selectTriggerClass =
  "w-full rounded-biso-sm border-edge bg-surface text-ink shadow-none hover:border-ink-muted data-[size=default]:h-10 data-placeholder:text-ink-muted dark:bg-surface dark:hover:bg-surface [&_svg:not([class*='text-'])]:text-ink-muted";

/** The open list of a select or combobox: an overlay, so it takes elevation. */
export const selectContentClass =
  "rounded-biso-sm border-edge bg-surface-raised text-ink shadow-elev-1";

export const selectItemClass = "focus:bg-surface-sunken focus:text-ink";

/** A field's label: the uppercase micro-label role, in full ink. */
export const fieldLabelClass = "type-label block text-ink";

/** Shared keyboard focus indicator for the composer's own buttons and links. */
export const focusRingClass =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

/**
 * The canonical CTAs, made safe to disable: a disabled button neither dims on
 * hover nor changes colour, it just fades.
 */
export const primaryActionClass = cn(
  statusPanelPrimaryAction,
  "justify-center text-center disabled:pointer-events-none disabled:opacity-60"
);

export const secondaryActionClass = cn(
  statusPanelSecondaryAction,
  "justify-center text-center disabled:pointer-events-none disabled:opacity-60"
);
