import { describe, expect, test } from "bun:test";
import dashboard from "./platform-health-dashboard.json";

const PROJECT_IDS = [
  4_512_446_739_972_176, 4_512_446_740_037_712, 4_512_446_740_103_248,
  4_512_446_740_234_320, 4_512_446_740_299_856,
];
const EXPECTED_WIDGETS = 11;

describe("platform health dashboard", () => {
  test("has title, projects and environment", () => {
    expect(dashboard.title).toBe("BISO platform health");
    expect([...dashboard.projects].sort()).toEqual([...PROJECT_IDS].sort());
    expect(dashboard.environment).toEqual(["production"]);
  });

  test("has all widgets, each with a query and a layout", () => {
    expect(dashboard.widgets).toHaveLength(EXPECTED_WIDGETS);
    for (const widget of dashboard.widgets) {
      expect(widget.queries.length).toBeGreaterThan(0);
      for (const query of widget.queries) {
        expect(query.fields.length).toBeGreaterThan(0);
      }
      expect(widget.layout.w).toBeGreaterThan(0);
      expect(widget.layout.h).toBeGreaterThan(0);
    }
  });

  test("does not reference the app project", () => {
    expect(JSON.stringify(dashboard)).not.toContain("biso-app");
  });
});
