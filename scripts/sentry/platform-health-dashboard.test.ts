import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import dashboard from "./platform-health-dashboard.json";

/** Sentry rejects grouped time-series widgets that ask for more series. */
const MAX_GROUPED_SERIES = 5;
const METRICS_SOURCE = new URL(
  "../../packages/observability/src/metrics.ts",
  import.meta.url
);
const METRIC_TYPE_BODY = /export type MetricName =([^;]+);/;
const METRIC_NAME = /"([a-z_.]+)"/g;
const METRIC_FIELD = /^(?:sum|min|max)\(value,([^,)]+),/;

/** The names in `MetricName`, read from the source rather than copied. */
const metricNames = (): string[] => {
  const body = METRIC_TYPE_BODY.exec(readFileSync(METRICS_SOURCE, "utf8"));
  return body?.[1] ? [...body[1].matchAll(METRIC_NAME)].map((m) => m[1]) : [];
};

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

  test("grouped line and area widgets ask for at most 5 series", () => {
    const grouped = dashboard.widgets.filter(
      (widget) =>
        (widget.displayType === "line" || widget.displayType === "area") &&
        widget.queries.some((query) => (query.columns ?? []).length > 0)
    );
    expect(grouped.length).toBeGreaterThan(0);
    for (const widget of grouped) {
      expect(widget.limit).not.toBeNull();
      expect(widget.limit ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(
        MAX_GROUPED_SERIES
      );
    }
  });

  test("every metric field names a metric the code can send", () => {
    const known = metricNames();
    expect(known).toContain("payment.failed");
    const used = dashboard.widgets
      .flatMap((widget) => widget.queries)
      .flatMap((query) => [...query.fields, ...(query.aggregates ?? [])])
      .map((field) => METRIC_FIELD.exec(field)?.[1])
      .filter((name): name is string => name !== undefined);
    expect(used.length).toBeGreaterThan(0);
    for (const name of used) {
      expect(known).toContain(name);
    }
  });
});
