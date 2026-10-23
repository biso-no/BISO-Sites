import type { LinkButton } from "@/editor/types";
import { externalLinkProps, safeHref } from "./links";

/** Copied from the site's `statusPanelPrimaryAction` / `…SecondaryAction`. */
export const BUTTON_CLASS: Record<LinkButton["style"], string> = {
  primary:
    "type-label inline-flex items-center gap-2 rounded-biso-pill bg-action px-5 py-3 text-action-ink transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
  secondary:
    "type-label inline-flex items-center gap-2 rounded-biso-pill border border-edge px-5 py-3 text-ink transition-colors hover:border-ink-accent hover:text-ink-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
};

export function ButtonLink({ button }: { button: LinkButton }) {
  const href = safeHref(button.href);
  if (href === null) {
    return <span className={BUTTON_CLASS[button.style]}>{button.label}</span>;
  }
  return (
    <a
      className={BUTTON_CLASS[button.style]}
      href={href}
      {...externalLinkProps(href)}
    >
      {button.label}
    </a>
  );
}
