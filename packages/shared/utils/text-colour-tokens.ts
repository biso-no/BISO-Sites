/**
 * The five tokens a rich text span may carry (`<span data-color="red">`).
 * A module of its own with nothing else in it, so the sanitisers, the public
 * renderer's among them, read the list without the swatches and colour maths
 * of `text-colours.ts`.
 */
export const TEXT_COLOUR_TOKENS = [
  "accent",
  "muted",
  "green",
  "amber",
  "red",
] as const;

export type TextColourToken = (typeof TEXT_COLOUR_TOKENS)[number];
