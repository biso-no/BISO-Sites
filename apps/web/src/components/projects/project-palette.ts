import type { ParsedLargeEvent } from "@/lib/types/large-event";

type PaletteSource = Pick<
  ParsedLargeEvent,
  "gradient" | "gradientHex" | "primaryColorHex" | "secondaryColorHex"
>;

const nonEmpty = (values: (string | null | undefined)[] | null | undefined) =>
  (values ?? []).filter((value): value is string => Boolean(value?.trim()));

/**
 * A project's own colours, from its `large_event` row — or `null`.
 *
 * Spec §7.4: flagships own brand palettes (`gradientHex[]`, `primaryColorHex`,
 * `secondaryColorHex`), and the chevron frame is where they show, so a project
 * keeps its identity inside BISO's frame instead of overriding the page.
 * `null` when the row is absent or carries no colour — which is every project
 * today (PLACEHOLDER-011) — and no stand-in palette is invented for it.
 */
export function projectPalette(
  event: PaletteSource | null | undefined
): string[] | null {
  if (!event) {
    return null;
  }
  for (const candidate of [
    nonEmpty(event.gradient),
    nonEmpty(event.gradientHex),
    nonEmpty([event.primaryColorHex, event.secondaryColorHex]),
  ]) {
    if (candidate.length > 0) {
      return candidate;
    }
  }
  return null;
}

/** A palette as a CSS `background`: one colour flat, several as a gradient. */
export function paletteBackground(palette: string[]): string {
  return palette.length > 1
    ? `linear-gradient(90deg, ${palette.join(", ")})`
    : (palette[0] ?? "");
}
