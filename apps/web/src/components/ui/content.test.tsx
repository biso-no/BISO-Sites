import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { codeOnly } from "@/test/source";

const read = (f: string) => readFileSync(join(import.meta.dirname, f), "utf8");
const heading = codeOnly(read("section-heading.tsx"));
const pill = codeOnly(read("pill.tsx"));
const dateBlock = codeOnly(read("date-block.tsx"));
const statRow = codeOnly(read("stat-row.tsx"));

describe("content primitives (RD-011)", () => {
  it("draws the sun marker only when the section leads somewhere", () => {
    // The marker means "there is more behind this" (spec §7.3). If it becomes a
    // style prop it goes back to being decoration, so the ONLY thing that turns
    // it on is a destination.
    expect(heading).toContain(
      "const leadsSomewhere = Boolean(seeAllHref && seeAllLabel)"
    );
    expect(heading).toContain("leadsSomewhere &&");
    // no independent switch for it
    expect(heading).not.toContain("showMarker");
    expect(heading).not.toContain("marker?:");
  });

  it("keeps the see-all link keyboard-visible", () => {
    expect(heading).toContain("focus-visible:ring-2");
  });

  it("gives every pill tone a tint of its own colour", () => {
    for (const tone of [
      "accent",
      "success",
      "warning",
      "danger",
      "marker",
      "neutral",
    ]) {
      expect(pill).toContain(`${tone}:`);
    }
  });

  it("renders a real <time> with a machine-readable date", () => {
    // Three visual fragments are not a date. Assistive tech and parsers need
    // the ISO value.
    expect(dateBlock).toContain("<time");
    expect(dateBlock).toContain("dateTime={iso}");
  });

  it("uses the tabular data role for figures", () => {
    expect(dateBlock).toContain("type-data");
    expect(statRow).toContain("type-data");
  });

  it("collapses the stat row to 2x2 on small screens", () => {
    expect(statRow).toContain("grid-cols-2");
    expect(statRow).toContain("sm:grid-cols-4");
  });

  it("marks up stats as a description list", () => {
    // A figure and its label are a pair, not two spans.
    expect(statRow).toContain("<dl");
    expect(statRow).toContain("<dt");
    expect(statRow).toContain("<dd");
  });
});
