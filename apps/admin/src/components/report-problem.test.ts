import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (path: string) =>
  readFileSync(join(import.meta.dir, path), "utf8");

describe("report a problem in admin", () => {
  test("the form opens as admin, which turns screenshots off", () => {
    expect(read("report-problem.tsx")).toContain('openFeedbackForm("admin"');
  });

  test("the sidebar footer has a button that opens it", () => {
    const sidebar = read("../app/(portal)/sidebar.tsx");
    expect(sidebar).toContain("useReportProblem");
    expect(sidebar).toContain("onClick={report.open}");
  });

  // 11 px text at line-height 1.5 plus 2 × 6 px padding is about 28 px tall,
  // above the 24 px minimum target size; the ring is the ink3 text colour,
  // about 4.9:1 on the sidebar's paper.
  test("the sidebar buttons show a focus ring and are big enough to hit", () => {
    const sidebar = read("../app/(portal)/sidebar.tsx");
    const buttons = sidebar.match(
      /className="rounded-md px-1\.5 py-1\.5 [^"]*focus-visible:ring-2 focus-visible:ring-current"/g
    );
    expect(buttons).toHaveLength(2);
  });

  test("the command palette has a Report a Problem command", () => {
    const palette = read("../app/(portal)/_components/command-palette.tsx");
    expect(palette).toContain('label: "Report a Problem"');
    expect(palette).toContain("reportProblem.open()");
  });
});
