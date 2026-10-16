import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { codeOnly } from "@/test/source";

const read = (f: string) => readFileSync(join(import.meta.dirname, f), "utf8");
const container = read("container.tsx");
const section = read("section.tsx");
const prose = read("prose.tsx");
const proseCode = codeOnly(prose);
const globals = readFileSync(
  join(import.meta.dirname, "../../../../../packages/ui/styles/globals.css"),
  "utf8"
);

const SECTION_Y = /--section-y:\s*clamp\(3rem,\s*6vw,\s*5rem\)/;
const SECTION_Y_LG = /--section-y-lg:\s*clamp\(4rem,\s*9vw,\s*8rem\)/;

describe("layout primitives (RD-009)", () => {
  it("offers exactly two section rhythms", () => {
    // Phase 0 found four in use (py-16 85x, py-12 34x, py-24 11x, py-20 7x).
    // A third value here means the drift has started again.
    expect(globals).toMatch(SECTION_Y);
    expect(globals).toMatch(SECTION_Y_LG);
    expect(section).toContain('base: "var(--section-y)"');
    expect(section).toContain('lg: "var(--section-y-lg)"');
  });

  it("owns the fixed-header offset in one place", () => {
    // Four different pt-* values hand-compensated for the same 80px nav.
    // clearNav replaces all of them; NAV_HEIGHT must track the nav's h-20.
    expect(section).toContain('NAV_HEIGHT = "5rem"');
    expect(section).toContain("clearNav");
  });

  it("keeps one gutter and one width scale", () => {
    expect(container).toContain("px-4 sm:px-6 lg:px-8");
    expect(container).toContain("max-w-biso");
    expect(container).toContain("max-w-biso-wide");
  });

  it("caps prose at the measured token, not an arbitrary max-w", () => {
    // 51 prose blocks were max-w-4xl (~100 characters), over the brief's floor.
    expect(prose).toContain("max-w-(--measure)");
    expect(proseCode).not.toContain("max-w-4xl");
  });

  it("underlines prose links rather than relying on colour alone", () => {
    expect(prose).toContain("[&_a]:underline");
  });

  it("lets wide content scroll inside itself instead of widening the page", () => {
    expect(prose).toContain("[&_table]:overflow-x-auto");
    expect(prose).toContain("[&_pre]:overflow-x-auto");
  });
});
