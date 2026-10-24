// A 3px stroke behind the title's text, drawn on a pseudo-element so the text
// keeps the section's own surface as its background (same as the site's
// SectionHeading).
export const MARKER_CLASS =
  "relative pb-1 after:absolute after:inset-x-0 after:bottom-0 after:-z-10 after:h-[3px] after:bg-marker after:content-['']";

export const LINK_CLASS =
  "type-body-sm text-ink-accent underline-offset-4 hover:underline focus-visible:rounded-biso-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring";
