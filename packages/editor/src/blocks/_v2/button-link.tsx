import type { LinkButton } from "@/editor/types";

/** Copied from the site's `statusPanelPrimaryAction` / `…SecondaryAction`. */
export const BUTTON_CLASS: Record<LinkButton["style"], string> = {
  primary:
    "type-label inline-flex items-center gap-2 rounded-biso-pill bg-action px-5 py-3 text-action-ink transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
  secondary:
    "type-label inline-flex items-center gap-2 rounded-biso-pill border border-edge px-5 py-3 text-ink transition-colors hover:border-ink-accent hover:text-ink-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
};

const EXTERNAL_RE = /^https?:\/\//i;

export function ButtonLink({ button }: { button: LinkButton }) {
  const external = EXTERNAL_RE.test(button.href);
  return (
    <a
      className={BUTTON_CLASS[button.style]}
      href={button.href}
      rel={external ? "noopener" : undefined}
      target={external ? "_blank" : undefined}
    >
      {button.label}
    </a>
  );
}
