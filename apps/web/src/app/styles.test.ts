import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const BRAND_DECLARATION = /^\s*--brand:/m;
const INVERTED_DECLARATION = /^\s*--inverted:/m;
const SECTION_DECLARATION = /^\s*--section:/m;

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
