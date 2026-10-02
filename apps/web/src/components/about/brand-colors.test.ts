import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * "Om BISO" keeps to the BISO brand: blue and navy, via the `brand-*` tokens.
 * The section used to give every topic its own Tailwind palette colour
 * (purple, amber, emerald, pink …), which read as nine unrelated brands.
 *
 * Covers the about pages and the other pages in the Om BISO menu. The
 * whistleblowing form (`components/safety`) is deliberately not listed: its
 * amber warning and green confirmation are status colours, not decoration.
 */
const PUBLIC_ROUTES = join(import.meta.dirname, "../../app/(public)");
const ABOUT_DIRECTORIES = [
  join(import.meta.dirname, "."),
  join(PUBLIC_ROUTES, "about"),
  join(PUBLIC_ROUTES, "business"),
  join(PUBLIC_ROUTES, "business-hotspot"),
  join(PUBLIC_ROUTES, "contact"),
  join(PUBLIC_ROUTES, "safety"),
];

const PALETTE_COLOR_CLASS =
  /\b(?:from|via|to|bg|text|border|ring|fill|stroke)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}(?:\/\d+)?\b/g;

/**
 * `primary` has no numbered shades in this theme, so `text-primary-100` and
 * friends are silently dropped. On a white button that leaves white text.
 */
const UNDEFINED_PRIMARY_SHADE =
  /\b(?:from|via|to|bg|text|border)-primary-\d{2,3}\b/g;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".tsx"))
    .map((entry) => join(entry.parentPath, entry.name));
}

describe("Om BISO brand colours", () => {
  it("uses brand tokens rather than Tailwind palette colours", () => {
    const offenders = ABOUT_DIRECTORIES.flatMap(sourceFiles).flatMap((file) =>
      (readFileSync(file, "utf8").match(PALETTE_COLOR_CLASS) ?? []).map(
        (className) => `${file.split("/src/")[1]}: ${className}`
      )
    );

    expect(offenders).toEqual([]);
  });

  it("uses no colour class the theme does not define", () => {
    const offenders = ABOUT_DIRECTORIES.flatMap(sourceFiles).flatMap((file) =>
      (readFileSync(file, "utf8").match(UNDEFINED_PRIMARY_SHADE) ?? []).map(
        (className) => `${file.split("/src/")[1]}: ${className}`
      )
    );

    expect(offenders).toEqual([]);
  });
});
