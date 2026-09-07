import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { codeOnly } from "@/test/source";

const BRAND_DECLARATION = /^\s*--brand:/m;
const INVERTED_DECLARATION = /^\s*--inverted:/m;
const SECTION_DECLARATION = /^\s*--section:/m;
const V2_PALETTE_DECLARATION = /^\s*--biso-(deep|blue|sky|sun):/m;
const V2_CONTRAST_NOTE = /2\.80:1|fails AA/;
const V2_DISPLAY_FONT = /--font-biso-display:\s*\n?\s*var\(--font-archivo\)/;

const styles = readFileSync(join(import.meta.dirname, "styles.css"), "utf8");
const adminStyles = readFileSync(
  join(import.meta.dirname, "../../../admin/src/app/styles.css"),
  "utf8"
);
const surface = readFileSync(
  join(import.meta.dirname, "../../../../packages/ui/styles/biso-surface.css"),
  "utf8"
);
const globals = readFileSync(
  join(import.meta.dirname, "../../../../packages/ui/styles/globals.css"),
  "utf8"
);

describe("brand token ownership", () => {
  it("keeps the public palette in the shared BISO surface", () => {
    expect(surface).toContain(":where(.biso-surface)");
    expect(surface).toContain("--brand:");
    expect(surface).toContain("--inverted:");
    expect(surface).toContain("--section:");
  });

  it("supports dark mode when the theme class is on or above the surface", () => {
    expect(surface).toContain(
      ":where(.dark.biso-surface, .dark .biso-surface)"
    );
  });

  it("removes duplicate brand declarations from the web app stylesheet", () => {
    expect(styles).not.toMatch(BRAND_DECLARATION);
    expect(styles).not.toMatch(INVERTED_DECLARATION);
    expect(styles).not.toMatch(SECTION_DECLARATION);
  });

  it("imports the shared surface", () => {
    expect(styles).toContain("biso-surface.css");
  });
});

describe("brand typography", () => {
  it("maps Tailwind font utilities through surface-specific backing variables", () => {
    expect(surface).toContain("--font-biso-sans:");
    expect(surface).toContain("--font-biso-display:");
    expect(surface).toContain("var(--font-inter)");
    // The legacy block still references --font-museo, and must: apps/admin
    // loads its own Museo Sans from apps/admin/public and resolves this block.
    // apps/web no longer loads it — `.biso-surface-v2` overrides
    // --font-biso-display with Archivo (see the RD-006 block below).
    expect(surface).toContain("var(--font-museo)");
    expect(globals).toContain("--font-sans: var(--font-biso-sans,");
    expect(globals).toContain("--font-display: var(--font-biso-display,");
    expect(globals).not.toContain("--font-display: var(--font-display)");
  });

  it("keeps font utilities valid in hosts without the BISO surface", () => {
    expect(globals).toContain("--font-host-sans:");
    expect(globals).toContain("--font-host-display:");
    expect(globals).toContain(
      "--font-sans: var(--font-biso-sans, var(--font-host-sans))"
    );
    expect(globals).toContain(
      "--font-display: var(--font-biso-display, var(--font-host-display))"
    );
  });
});

describe("editor utility discovery", () => {
  it("scans the shared editor package in both Next.js hosts", () => {
    const editorSource =
      '@source "../../../../packages/editor/src/**/*.{ts,tsx}";';

    expect(styles).toContain(editorSource);
    expect(adminStyles).toContain(editorSource);
  });
});

describe("BISO 2026 redesign surface (RD-005)", () => {
  it("owns the new palette in the shared surface, not in the app", () => {
    // Same ownership rule as the legacy palette: the values live in
    // packages/ui so apps/admin's editor canvas can preview the surface
    // students see. This mirrors the assertions above rather than weakening
    // them — the app stylesheet must not declare these either.
    expect(surface).toContain(":where(.biso-surface-v2)");
    expect(surface).toContain("--biso-deep:");
    expect(surface).toContain("--biso-blue:");
    expect(surface).toContain("--biso-sky:");
    expect(surface).toContain("--biso-sun:");
    expect(styles).not.toMatch(V2_PALETTE_DECLARATION);
  });

  it("adds the v2 surface without editing the legacy one", () => {
    // The whole migration strategy depends on both classes coexisting: old
    // components keep reading --brand/--primary/--inverted while new ones read
    // --biso-*. If the legacy block were edited instead of appended to, every
    // unmigrated page would repaint at once and apps/admin would move with it.
    //
    // RD-030 was scoped to delete the legacy tokens "once unreferenced", and
    // they are not: 654 `bg-/text-/border-brand*|inverted*|section*` utilities
    // are still live in apps/web after the v1 tree was removed — the units
    // subtree, checkout, the member portal, expense-v3, the join wizard. They
    // stay until those bodies are restyled. See RD-030 in STATUS.md.
    expect(surface).toContain(":where(.biso-surface)");
    expect(surface).toContain("--brand:");
    expect(surface).toContain("--inverted:");
    expect(surface).toContain("--section:");
  });

  it("restricts --biso-sky to non-text use by documenting the contrast failure", () => {
    // White on #3AA3E1 is 2.80:1 and the reference's own button blue (#217EC7)
    // is 4.31:1 — both below AA. --biso-blue (#1668AE) is the corrected action
    // colour at 5.79:1 in both directions. Losing this note loses the reason.
    expect(surface).toMatch(V2_CONTRAST_NOTE);
    expect(surface).toContain("#1668ae");
  });

  it("maps the new tokens to Tailwind utilities with legacy fallbacks", () => {
    // A host that has not mounted .biso-surface-v2 must degrade to the legacy
    // token rather than emit an invalid value.
    expect(globals).toContain("--color-ink: var(--ink, var(--foreground))");
    expect(globals).toContain("--color-action: var(--action, var(--brand))");
    expect(globals).toContain(
      "--color-deep: var(--biso-deep, var(--inverted))"
    );
  });

  it("defines the single chevron angle once", () => {
    // One angle for the whole system. If a second appears, the motif stops
    // reading as a system and becomes decoration.
    expect(globals).toContain("--shear: 13deg");
    expect(globals).toContain("--shear-run: 0.2309");
  });
});

describe("BISO 2026 display typeface (RD-006)", () => {
  it("overrides the display face in v2 without touching the legacy block", () => {
    // apps/admin resolves the legacy block and must keep Museo Sans; apps/web
    // mounts v2 and gets Archivo. Both live in the same file, later wins.
    expect(surface).toContain("--font-archivo");
    expect(surface).toMatch(V2_DISPLAY_FONT);
  });

  it("no longer ships Museo Sans from apps/web", () => {
    // 62 KB unsubsetted .otf, in the Link: rel=preload header on every route,
    // rendered zero times — the `font-display` utility appeared nowhere.
    // See baseline/README.md FINDING-B.
    expect(
      existsSync(join(import.meta.dirname, "../../public/museo_sans_300.otf"))
    ).toBe(false);
  });

  it("defines all nine type roles", () => {
    for (const role of [
      "type-display-hero",
      "type-display-lg",
      "type-display-sm",
      "type-heading-section",
      "type-heading-card",
      "type-body",
      "type-body-sm",
      "type-label",
      "type-data",
    ]) {
      expect(globals).toContain(`.${role}`);
    }
  });

  it("keeps the measured display metrics", () => {
    // Hero cap-height 56px over 66px baseline-to-baseline in the reference =
    // line-height 0.85. If this drifts to a normal 1.1, the treatment is gone.
    expect(globals).toContain("line-height: 0.85");
    // Capped in RD-018: Norwegian compounds are unbreakable tokens and at
    // 6.5rem the longest overflowed its grid cell. See 01-design-spec.md §1.5.
    expect(globals).toContain("clamp(2.5rem, 7vw, 5rem)");
  });

  it("makes the data role tabular so columns align", () => {
    expect(globals).toContain("font-variant-numeric: tabular-nums");
  });

  it("sets the prose measure in ch that actually renders under 80 characters", () => {
    // `ch` is the advance of "0", which in Inter is far wider than the average
    // character in running prose. 68ch renders up to 91 characters per line —
    // over the brief's 80 floor. 54ch renders ~72. Measured in RD-007 by
    // walking a Range and recording where each visual line breaks.
    expect(globals).toContain("--measure: 54ch");
    expect(globals).not.toContain("--measure: 68ch");
  });
});

/**
 * The dead-utility guard.
 *
 * Tailwind v4 emits a colour utility **only** for a name registered in
 * `@theme`. An unregistered one compiles to nothing, silently — no build error,
 * no console warning, just a rule that does not exist. RD-019 found
 * `ring-focus-ring` dead in all 27 places it was used (every affected control
 * had *less* visible focus than the browser default, because the
 * `focus-visible:outline-none` beside it did apply). RD-021 found
 * `bg-surface-sunken` dead in all 8 — the media frames, the job page's GDPR
 * note, and every block in the v2 loading shells, which were rendering as
 * blank space.
 *
 * Two instances of one mistake is a class, so this checks the class: every
 * colour utility written in the redesign's own components must resolve to a
 * registered `--color-*`. Scoped to `components/ui` and the `v2` folders —
 * the v1 tree carries its own dead utilities (`text-primary-60`,
 * `bg-blue-accent`, `shadow-card-soft`, and others) and is being replaced
 * package by package, so failing on those would only teach the suite to be
 * ignored.
 */
const COLOR_PREFIXES = [
  "bg",
  "text",
  "border",
  "ring-offset",
  "ring",
  // Before "outline", so `outline-offset-2` parses as <outline-offset><2> and
  // is skipped as numeric — the same shape as `ring-offset`. Without it the
  // guard read the size as a colour name and reported a false offender.
  "outline-offset",
  "fill",
  "stroke",
  "divide",
  "from",
  "via",
  "to",
  "outline",
  "decoration",
  "placeholder",
] as const;

const TAILWIND_KEYWORDS = new Set([
  "inherit",
  "current",
  "transparent",
  "black",
  "white",
  "none",
  "auto",
]);

/** Values these prefixes take that are sizes or keywords, never colours. */
const NON_COLOR_VALUES = new Set([
  "xs",
  "sm",
  "base",
  "lg",
  "xl",
  "2xl",
  "3xl",
  "4xl",
  "5xl",
  "6xl",
  "7xl",
  "left",
  "center",
  "right",
  "justify",
  "start",
  "end",
  "top",
  "bottom",
  "middle",
  "balance",
  "pretty",
  "nowrap",
  "wrap",
  "solid",
  "dashed",
  "dotted",
  "double",
  "hidden",
  "clip-text",
  "ellipsis",
  "collapse",
  "separate",
  "cover",
  "contain",
  "repeat",
  "no-repeat",
  "full",
  "screen",
  "px",
  // Bare side utilities are widths, not colours: `border-b`, `border-t`.
  "t",
  "r",
  "b",
  "l",
  "x",
  "y",
  "s",
  "e",
]);

const PALETTE = /^[a-z]+-\d{2,3}$/;
const CLASS_STRING = /["'`]([^"'`\n]{3,800})["'`]/g;
const HAS_COLOR_PREFIX =
  /(^|\s)[a-z-]*(bg|text|border|ring|fill|stroke|from|via|to|outline)-/;
const VARIANTS = /^(?:[a-z0-9[\]().%-]+:)+/;
const LEADING_MODIFIER = /^[!-]/;
const WHITESPACE = /\s+/;
const GRADIENT_DIRECTION = /^linear-to-[a-z]{1,2}$/;
const COLOR_REGISTRATION = /--color-([a-z0-9-]+)\s*:/g;
const SUNKEN_DECLARATION = /--surface-sunken:/g;
const FOCUS_RING_DECLARATION = /--focus-ring:/g;
const NUMERIC = /^\d+(\.\d+)?$/;
const SIDE = /^[trblxyse]-/;

function collectClasses(source: string): string[] {
  const out: string[] = [];
  for (const match of source.matchAll(CLASS_STRING)) {
    const value = match[1];
    if (!HAS_COLOR_PREFIX.test(value)) {
      continue;
    }
    out.push(...value.split(WHITESPACE));
  }
  return out;
}

function unresolvedColorUtilities(
  source: string,
  registered: Set<string>
): string[] {
  const found: string[] = [];
  for (const cls of collectClasses(source)) {
    // Strip variants (`hover:`, `focus-visible:`, `lg:`), `!` and `-` prefixes.
    let bare = cls.replace(VARIANTS, "").replace(LEADING_MODIFIER, "");
    if (bare.includes("[")) {
      continue; // arbitrary value — Tailwind emits it verbatim
    }
    bare = bare.split("/")[0]; // drop the opacity modifier
    const prefix = COLOR_PREFIXES.find((p) => bare.startsWith(`${p}-`));
    if (!prefix) {
      continue;
    }
    let name = bare.slice(prefix.length + 1);
    // `border-t-white` / `divide-y-edge`: the side is part of the utility.
    if ((prefix === "border" || prefix === "divide") && SIDE.test(name)) {
      name = name.slice(2);
    }
    if (
      !name ||
      NUMERIC.test(name) ||
      TAILWIND_KEYWORDS.has(name) ||
      NON_COLOR_VALUES.has(name) ||
      PALETTE.test(name) ||
      GRADIENT_DIRECTION.test(name)
    ) {
      continue;
    }
    if (!registered.has(name)) {
      found.push(`${prefix}-${name}`);
    }
  }
  return [...new Set(found)];
}

describe("colour utilities resolve to registered tokens", () => {
  const registered = new Set(
    [...`${globals}\n${surface}`.matchAll(COLOR_REGISTRATION)].map(
      (match) => match[1]
    )
  );

  const roots = [
    join(import.meta.dirname, "../components/ui"),
    join(import.meta.dirname, "../components/home/v2"),
    join(import.meta.dirname, "../components/jobs/v2"),
    join(import.meta.dirname, "../components/events/v2"),
    join(import.meta.dirname, "../components/news/v2"),
    join(import.meta.dirname, "../components/shop/v2"),
    join(import.meta.dirname, "../components/campus/v2"),
    join(import.meta.dirname, "../components/membership/v2"),
    join(import.meta.dirname, "../components/units/v2"),
    join(import.meta.dirname, "../components/documents/v2"),
    // Not a `v2` folder, but converted by RD-028 — and the directory where the
    // third and fourth dead utilities were found (`bg-surface-strong`, plus a
    // `bg-secondary-30` / `bg-blue-accent` pair painting two invisible blur
    // orbs). Scanned from here on so the class of bug cannot come back.
    join(import.meta.dirname, "../components/profile"),
    join(import.meta.dirname, "../components/expense/v2"),
    join(import.meta.dirname, "../components/nav"),
    join(import.meta.dirname, "../components/layout"),
  ].filter((dir) => existsSync(dir));

  const files = roots.flatMap((dir) =>
    readdirSync(dir)
      .filter((name) => name.endsWith(".tsx"))
      .map((name) => join(dir, name))
  );

  it("scans the redesign's components", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it("finds no utility naming a colour Tailwind was never told about", () => {
    const offenders: string[] = [];
    for (const file of files) {
      // `codeOnly`: a doc comment naming the dead utility it replaced is not a
      // usage. Third time this trap has been hit — see `src/test/source.ts`.
      for (const utility of unresolvedColorUtilities(
        codeOnly(readFileSync(file, "utf8")),
        registered
      )) {
        offenders.push(`${file.split("/src/")[1]}: ${utility}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("registers the two aliases that were found dead", () => {
    expect(registered.has("focus-ring")).toBe(true);
    expect(registered.has("surface-sunken")).toBe(true);
  });

  it("backs every registered semantic alias with a per-surface value", () => {
    // A registered `--color-x: var(--x, …)` still paints the fallback unless
    // `--x` is set on the surface. Both of the aliases above are set in all
    // four surface blocks (light, deep band, dark, deep-in-dark).
    const sunken = surface.match(SUNKEN_DECLARATION) ?? [];
    const focus = surface.match(FOCUS_RING_DECLARATION) ?? [];
    expect(sunken.length).toBeGreaterThanOrEqual(3);
    expect(focus.length).toBeGreaterThanOrEqual(3);
  });
});

/**
 * RD-030 — what the retirement actually removed, and what it deliberately did
 * not.
 */
describe("legacy retirement (RD-030)", () => {
  it("stops the universal rule from overriding every outline colour", () => {
    // `* { @apply border-border outline-ring/50 }` beat every `outline-<color>`
    // utility in the app, so focus outlines were always the same translucent
    // grey. Measured after removal: `outline-focus-ring` computes to
    // rgb(58, 163, 225). FINDING-F.
    // `codeOnly`: the comment beside the rule names what it replaced.
    expect(globals).toContain("@apply border-border;");
    expect(codeOnly(globals)).not.toContain("outline-ring/50");
  });

  it("scopes the base type defaults to headings", () => {
    // The old selector parsed as "an ancestor containing a class^=text-
    // descendant but no class*=' text-' one", which almost nothing satisfies.
    // Extending the corrected form to p/label/button/input regressed admin —
    // an explicit font-size on a child overrides the size it inherited from
    // its container — so only h1-h4 carry it.
    expect(globals).toContain('h1:not([class*="text-"])');
    expect(globals).toContain('h4:not([class*="text-"])');
    expect(globals).not.toContain('p:not([class*="text-"])');
    expect(codeOnly(globals)).not.toContain(':has([class*=" text-"])');
  });

  it("removes the button and card variants that named undefined colours", () => {
    // `codeOnly` throughout: the comments left in both files name every dead
    // colour they replaced, which is exactly what these assertions look for.
    const uiComponent = (name: string) =>
      codeOnly(
        readFileSync(
          join(
            import.meta.dirname,
            `../../../../packages/ui/components/ui/${name}.tsx`
          ),
          "utf8"
        )
      );
    const button = uiComponent("button");
    const card = uiComponent("card");

    for (const dead of [
      "gold-default",
      "gold-accent",
      "blue-accent",
      "blue-strong",
      "primary-80",
      "primary-90",
    ]) {
      expect(button, dead).not.toContain(dead);
      expect(card, dead).not.toContain(dead);
    }
    // `gradient` survives because three call sites use it; its dead ::before
    // gradient does not.
    expect(button).toContain("gradient:");
    expect(button).not.toContain("before:from-");
    // Card has no variants left at all.
    expect(card).not.toContain("variant");
  });

  it("has no shell toggle left", () => {
    expect(
      existsSync(join(import.meta.dirname, "../lib/shell-version.ts"))
    ).toBe(false);
    const shell = readFileSync(
      join(import.meta.dirname, "../components/layout/site-shell.tsx"),
      "utf8"
    );
    expect(shell).not.toContain("isShellV2Enabled");
    expect(shell).not.toContain("data-shell");
  });
});
