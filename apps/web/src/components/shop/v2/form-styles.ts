/**
 * The design system's skin for the `@repo/ui` form controls the shop uses.
 *
 * The redesign has no input primitive, and the shadcn controls read the old
 * palette (`border-input`, `bg-popover`, a dead `secondary-100` focus ring), so
 * every field on the product page and at checkout passes these instead.
 * `cn`/tailwind-merge in each control lets a later class replace the base one
 * it conflicts with, so these override rather than stack.
 *
 * Text fields take the same ring focus indicator `FeedSearch` uses. The select
 * trigger keeps its own outline indicator (already `outline-focus-ring`, and
 * pinned by the a11y suite) — adding a ring as well would draw two.
 */
export const shopFieldClass =
  "rounded-biso-sm border-edge bg-surface text-ink shadow-none placeholder:text-ink-muted hover:border-ink-muted focus:border-ink-accent focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

export const shopSelectTriggerClass =
  "w-full rounded-biso-sm border-edge bg-surface text-ink shadow-none hover:border-ink-muted data-[size=default]:h-10 data-placeholder:text-ink-muted dark:bg-surface dark:hover:bg-surface [&_svg:not([class*='text-'])]:text-ink-muted";

export const shopSelectContentClass =
  "rounded-biso-sm border-edge bg-surface-raised text-ink";

export const shopSelectItemClass = "focus:bg-surface-sunken focus:text-ink";

/** A field's label: the uppercase micro-label role, in full ink. */
export const shopFieldLabelClass = "type-label block text-ink";

/** Marks a field the buyer has to fix; paired with `aria-invalid`. */
export const shopFieldInvalidClass = "border-danger hover:border-danger";
