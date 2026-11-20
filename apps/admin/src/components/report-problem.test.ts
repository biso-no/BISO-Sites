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

  test("the command palette has a Report a Problem command", () => {
    const palette = read("../app/(portal)/_components/command-palette.tsx");
    expect(palette).toContain('label: "Report a Problem"');
    expect(palette).toContain("reportProblem.open()");
  });
});
