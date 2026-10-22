// Tailwind v4: `outline-none` would zero the style variable `outline-2` reads,
// so the ring names its style explicitly instead.

/** Visible keyboard focus on the board's paper background. */
export const BOARD_FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-[#6b1e1e] focus-visible:outline-offset-2";

/** The same ring drawn inside, for rows and tabs that sit flush together. */
export const BOARD_FOCUS_RING_INSET =
  "focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-[#6b1e1e] focus-visible:-outline-offset-2";
