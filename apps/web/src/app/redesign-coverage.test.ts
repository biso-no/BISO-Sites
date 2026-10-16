import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { codeOnly } from "@/test/source";

/**
 * Every page of apps/web is on the redesign (`docs/redesign/01-design-spec.md`).
 *
 * The redesign shipped with parts of the app still on the old palette — the
 * member portal bodies, checkout, the join wizard, the unit pages — and main
 * kept building new pages in the old system while it was in review. Merging
 * the two converted all of it. This keeps it that way: the old look cannot
 * come back file by file without failing here.
 *
 * What counts as the old look, in code (comments are stripped — several files
 * explain the utility they replaced):
 *   - the legacy brand palette as utilities: `bg-brand*`, `bg-section*`,
 *     `bg-inverted*`, numbered `primary`/`secondary` shades (undefined in this
 *     theme, so they also rendered white-on-white), `blue-strong`,
 *     `blue-accent`, `gold-*`;
 *   - decorative gradients, glassmorphism (`backdrop-blur`) and
 *     scroll-triggered reveals (`whileInView`) — spec §1.8 and §1.9;
 *   - shadcn's semantic colour tokens in our own class strings
 *     (`text-muted-foreground`, `bg-card`, `border-border` …). They resolve
 *     against the legacy surface, so in dark mode they turn neutral grey
 *     beside the navy the redesign's aliases resolve to. Use the aliases:
 *     `text-ink-muted`, `bg-surface-raised`, `border-edge`.
 *
 * `@repo/ui` components keep their own internal classes; this reads only the
 * files under `src/`.
 */
const SRC = join(import.meta.dirname, "..");

/**
 * Deliberate exceptions, each with its reason. Keep this list short.
 */
const EXCEPTIONS: Record<string, string> = {
  // The membership pass is a ticket shown to door staff: its body keeps its
  // own brand gradient, live dot and colour of the day, which scanner staff
  // recognise. Only the chrome around it follows the redesign.
  "components/member-pass/member-pass-card.tsx": "pass identity",
};

const LEGACY_PALETTE =
  /(?:^|[\s"'`:])(?:bg|text|border|from|via|to|ring|fill|stroke|outline|decoration|divide|shadow)-(?:brand(?:-[a-z-]+)?|section(?:\/\d+)?|inverted(?:-[a-z]+)?|primary-\d{2,3}|secondary-\d{2,3}|blue-strong|blue-accent|gold-[a-z]+)(?=[\s"'`/]|$)/m;
const DECORATIVE =
  /bg-linear-to-|bg-gradient-to-|backdrop-blur|whileInView|\bglass\b/;
const SHADCN_SEMANTIC =
  /(?:^|[\s"'`:])(?:text-muted-foreground|text-foreground|bg-background|bg-muted|bg-card|border-border|text-primary|bg-primary|bg-secondary|text-secondary-foreground|bg-accent)(?=[\s"'`/]|$)/m;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) &&
        !entry.name.includes(".test.")
    )
    .map((entry) => join(entry.parentPath, entry.name));
}

const files = sourceFiles(SRC)
  .map((file) => ({ file, rel: relative(SRC, file) }))
  .filter(({ rel }) => !(rel in EXCEPTIONS));

function offenders(pattern: RegExp): string[] {
  return files.flatMap(({ file, rel }) =>
    codeOnly(readFileSync(file, "utf8"))
      .split("\n")
      .filter((line) => pattern.test(line))
      .map((line) => `${rel}: ${line.trim().slice(0, 120)}`)
  );
}

describe("the whole app is on the redesign", () => {
  it("scans the app", () => {
    expect(files.length).toBeGreaterThan(300);
  });

  it("uses no legacy brand-palette utilities", () => {
    expect(offenders(LEGACY_PALETTE)).toEqual([]);
  });

  it("uses no decorative gradients, glass or scroll-triggered reveals", () => {
    expect(offenders(DECORATIVE)).toEqual([]);
  });

  it("uses the redesign's aliases instead of shadcn's semantic colours", () => {
    expect(offenders(SHADCN_SEMANTIC)).toEqual([]);
  });

  it("keeps every exception real", () => {
    // An exception for a file that no longer exists, or that no longer needs
    // it, is a hole waiting for a regression.
    for (const rel of Object.keys(EXCEPTIONS)) {
      const source = codeOnly(readFileSync(join(SRC, rel), "utf8"));
      expect(LEGACY_PALETTE.test(source) || DECORATIVE.test(source), rel).toBe(
        true
      );
    }
  });
});
