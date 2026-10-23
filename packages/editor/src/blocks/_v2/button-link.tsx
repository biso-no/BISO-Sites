import type { LinkButton } from "@/editor/types";
import { knownKey } from "./known-key";
import { externalLinkProps, safeHref } from "./links";

/** Copied from the site's `statusPanelPrimaryAction` / `…SecondaryAction`. */
export const BUTTON_CLASS: Record<LinkButton["style"], string> = {
  primary:
    "type-label inline-flex items-center gap-2 rounded-biso-pill bg-action px-5 py-3 text-action-ink transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
  secondary:
    "type-label inline-flex items-center gap-2 rounded-biso-pill border border-edge px-5 py-3 text-ink transition-colors hover:border-ink-accent hover:text-ink-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
};

/** The style's classes; an unknown style (copilot output) is primary. */
export function buttonClass(style: LinkButton["style"] | undefined): string {
  return BUTTON_CLASS[knownKey(BUTTON_CLASS, style, "primary")];
}

/**
 * True when the site shows the button: it has a label and a safe link. The
 * site drops the rest rather than show a pill that cannot be clicked.
 */
export function isLiveButton(button: LinkButton): boolean {
  return (
    typeof button.label === "string" &&
    button.label.trim() !== "" &&
    safeHref(button.href) !== null
  );
}

/**
 * A link on the site. In the editor (`edit`) it is an inert span with the same
 * look, so a click on the canvas never navigates away from unsaved edits; it
 * then shows "Button" for an empty label so the pill stays visible. A button
 * without a safe link is a span too; blocks drop those on the site.
 */
export function ButtonLink({
  button,
  edit = false,
}: {
  button: LinkButton;
  edit?: boolean;
}) {
  const className = buttonClass(button.style);
  const href = edit ? null : safeHref(button.href);
  if (href === null) {
    return (
      <span className={className}>
        {edit ? button.label || "Button" : button.label}
      </span>
    );
  }
  return (
    <a className={className} href={href} {...externalLinkProps(href)}>
      {button.label}
    </a>
  );
}
