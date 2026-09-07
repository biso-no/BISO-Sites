/** Surface a block paints. `auto` is resolved by `resolveBackgrounds`. */
export type BlockBackground =
  | "auto"
  | "default"
  | "muted"
  | "brand"
  | "inverted"
  | "accent";

export type BlockSpacing = "none" | "compact" | "normal" | "spacious";

export type BlockWidth = "prose" | "content" | "wide" | "full";

/** A background after `auto` has been resolved to a concrete surface. */
export type ResolvedBackground = Exclude<BlockBackground, "auto">;

/** Page-design controls shared by every block. */
export interface BlockLayout {
  background?: BlockBackground;
  spacing?: BlockSpacing;
  width?: BlockWidth;
}
