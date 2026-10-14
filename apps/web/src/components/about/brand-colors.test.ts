import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * "Om BISO" keeps to the BISO brand: blue and navy, via the `brand-*` tokens.
 * The section used to give every topic its own Tailwind palette colour
 * (purple, amber, emerald, pink …), which read as nine unrelated brands.
 *
 * Covers the about pages, the other pages in the Om BISO menu and the
 * membership page. The
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
  join(PUBLIC_ROUTES, "membership"),
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

/**
 * The same undefined class on a light button: the button falls back to its
 * default white label, leaving white on white. Checked across the whole app
 * because that is how the contact, membership and campus buttons all broke.
 */
const LIGHT_BUTTON_WITH_UNDEFINED_TEXT =
  /"[^"]*\bbg-(?:white|background)\b[^"]*\btext-primary-\d{2,3}\b[^"]*"/g;
const APP_SOURCE = join(import.meta.dirname, "../..");

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

describe("light buttons", () => {
  it("never pair a light background with an undefined text colour", () => {
    const offenders = sourceFiles(APP_SOURCE).flatMap((file) =>
      (
        readFileSync(file, "utf8").match(LIGHT_BUTTON_WITH_UNDEFINED_TEXT) ?? []
      ).map((className) => `${file.split("/src/")[1]}: ${className}`)
    );

    expect(offenders).toEqual([]);
  });
});
