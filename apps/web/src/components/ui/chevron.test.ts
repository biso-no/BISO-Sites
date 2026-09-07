import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { codeOnly } from "@/test/source";

const frame = readFileSync(
  join(import.meta.dirname, "chevron-frame.tsx"),
  "utf8"
);
const globals = readFileSync(
  join(import.meta.dirname, "../../../../../packages/ui/styles/globals.css"),
  "utf8"
);
const frameCode = codeOnly(frame);
const SECOND_SHEAR_TOKEN = /--shear-run-\w+:/;

describe("chevron (RD-010)", () => {
  it("derives the cut from the aspect ratio instead of a lookup table", () => {
    // A clip-path x-percentage resolves against WIDTH while the edge angle
    // depends on HEIGHT, so a fixed percentage cannot hold 13° across shapes.
    // The spec's original rounded table drifted — 3/2 landed at 12.68°. The
    // derived form is exact at every ratio and keeps frame and angle in
    // lockstep, because one --ar drives both.
    expect(globals).toContain(
      "--cut: calc(var(--shear-run, 0.2309) * var(--ar) * 100%)"
    );
    expect(globals).toContain("aspect-ratio: 1 / var(--ar)");
  });

  it("keeps one angle for the whole system", () => {
    expect(globals).toContain("--shear-run: 0.2309");
    // A second angle would make the motif decoration rather than a system.
    expect(codeOnly(globals)).not.toMatch(SECOND_SHEAR_TOKEN);
  });

  it("never rounds a sheared corner", () => {
    // Soft rectangles and hard angles do not meet on one element (spec §1.7).
    expect(globals).toContain("border-radius: 0");
  });

  it("makes media fill the frame with cover", () => {
    // The clip removes corners; it must not move or letterbox content.
    expect(globals).toContain("object-fit: cover");
  });

  it("offers all seven aspect ratios", () => {
    for (const r of ["21/9", "16/9", "3/2", "4/3", "1/1", "4/5", "3/4"]) {
      expect(frameCode).toContain(`"${r}"`);
    }
  });

  it("has no band variant", () => {
    // A 13° edge across a 1440px section drops 332px — taller than most
    // sections — and a shallower second angle would break the single-angle
    // rule. Dropped deliberately in RD-010; see 01-design-spec.md §1.10.
    expect(codeOnly(globals)).not.toContain("chevron-band");
  });
});
