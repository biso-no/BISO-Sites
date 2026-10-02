import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * "Om BISO" keeps to the BISO brand: blue and navy, via the `brand-*` tokens.
 * The section used to give every topic its own Tailwind palette colour
 * (purple, amber, emerald, pink …), which read as nine unrelated brands.
 */
const ABOUT_DIRECTORIES = [
  join(import.meta.dirname, "."),
  join(import.meta.dirname, "../../app/(public)/about"),
];

const PALETTE_COLOR_CLASS =
  /\b(?:from|via|to|bg|text|border|ring|fill|stroke)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}(?:\/\d+)?\b/g;

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
});
