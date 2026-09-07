import type { BlockLayout, ResolvedBackground } from "./layout-types";

/**
 * Resolves automatic surfaces once for the complete page so the editor and
 * public renderer share the same visual rhythm. Explicit choices are retained;
 * only automatic sections are prevented from repeating the previous surface.
 */
export const resolveBackgrounds = (
  blocks: { layout?: BlockLayout }[]
): ResolvedBackground[] => {
  const backgrounds: ResolvedBackground[] = [];
  let previous: ResolvedBackground | undefined;

  for (const block of blocks) {
    const explicit = block.layout?.background;
    if (explicit && explicit !== "auto") {
      backgrounds.push(explicit);
      previous = explicit;
      continue;
    }

    const next: ResolvedBackground =
      previous === "default" ? "muted" : "default";
    backgrounds.push(next);
    previous = next;
  }

  return backgrounds;
};
