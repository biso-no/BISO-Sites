import type { ReactNode } from "react";
import { Section } from "./section";

/**
 * The centred panel the error, not-found and unavailable states share.
 *
 * Five of these were written by hand across `(protected)` — each with its own
 * min-height, its own gradient and its own button treatment, and three of them
 * headed by an `<h2>` on a page that rendered no `<h1>` at all. One shape, one
 * heading level, and the actions are supplied by the caller because only they
 * know whether the action is a link or a `reset()`.
 */
export function StatusPanel({
  actions,
  body,
  icon,
  title,
}: {
  actions?: ReactNode;
  body: string;
  icon?: ReactNode;
  title: string;
}) {
  return (
    <Section clearNav tone="paper" width="prose">
      <div className="flex flex-col items-start gap-4 rounded-biso-md border border-edge p-10">
        {icon ? (
          <span aria-hidden="true" className="text-ink-muted">
            {icon}
          </span>
        ) : null}
        <h1 className="type-display-sm break-words text-ink">{title}</h1>
        <p className="type-body text-ink-muted">{body}</p>
        {actions ? (
          <div className="mt-2 flex flex-wrap gap-3">{actions}</div>
        ) : null}
      </div>
    </Section>
  );
}

export const statusPanelPrimaryAction =
  "type-label inline-flex items-center gap-2 rounded-biso-pill bg-action px-5 py-3 text-action-ink transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

export const statusPanelSecondaryAction =
  "type-label inline-flex items-center gap-2 rounded-biso-pill border border-edge px-5 py-3 text-ink transition-colors hover:border-ink-accent hover:text-ink-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface";
