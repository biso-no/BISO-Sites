import { describe, expect, test } from "bun:test";
import type { FinagoProjects } from "@repo/api/types/appwrite";
import { parseProjectName } from "@repo/shared/utils/finago-projects";
import {
  effectiveEventDates,
  filterGroups,
  groupProjects,
  type ProjectView,
} from "./projects-model";

const project = (data: Partial<ProjectView>): ProjectView => ({
  departments: [],
  effectiveDate: null,
  effectiveSource: null,
  eventDate: null,
  firstLineDate: null,
  id: "p",
  lastLineDate: null,
  name: "P",
  peakDate: null,
  series: null,
  year: null,
  ...data,
});

describe("projects page model", () => {
  test("the page groups projects by series", () => {
    const groups = groupProjects([
      project({
        id: "a",
        name: "Fadderuke 2025",
        series: "Fadderuke",
        year: 2025,
      }),
      project({
        id: "b",
        name: "Fadderuke 2026",
        series: "Fadderuke",
        year: 2026,
      }),
      project({ id: "c", name: "Julebord", series: null }),
    ]);

    expect(groups.map((group) => group.series)).toEqual([
      "Fadderuke",
      "Julebord",
    ]);
    expect(groups[0]?.projects.map((p) => p.id)).toEqual(["b", "a"]);
  });

  test("filtering by department keeps only series with a match", () => {
    const groups = groupProjects([
      project({
        departments: [{ id: "d1", name: "Events" }],
        id: "a",
        series: "X",
      }),
      project({ id: "b", series: "Y" }),
    ]);

    expect(filterGroups(groups, "d1").map((g) => g.series)).toEqual(["X"]);
    expect(filterGroups(groups, "").length).toBe(2);
  });
});

const row = (
  projectId: string,
  name: string,
  data: Partial<FinagoProjects> = {}
): FinagoProjects =>
  ({
    $id: `row-${projectId}`,
    active: true,
    event_date: null,
    line_count: 10,
    name,
    peak_date: null,
    project_id: projectId,
    ...parseProjectName(name),
    ...data,
  }) as FinagoProjects;

describe("effective event dates", () => {
  test("each project shows the date the AI check uses, and where it comes from", () => {
    const dates = effectiveEventDates(
      [
        // Closed in Finago, but its bookings still place next year's event.
        row("k25", "KD 2025", {
          active: false,
          peak_date: "2025-09-28T00:00:00.000+00:00",
        }),
        row("k26", "KD 2026"),
        row("l26", "Landsmøte mars 2026"),
        row("w27", "Wintergames 2027", {
          event_date: "2027-02-04T00:00:00.000+00:00",
        }),
        row("lunsj", "BISO-Lunsj"),
      ],
      "2026-11-19"
    );

    expect(dates.get("k26")).toEqual({
      eventDate: "2026-09-28",
      eventDateSource: "bookings",
    });
    expect(dates.get("l26")).toEqual({
      eventDate: "2026-03-15",
      eventDateSource: "name",
    });
    expect(dates.get("w27")).toEqual({
      eventDate: "2027-02-04",
      eventDateSource: "finance",
    });
    expect(dates.get("lunsj")).toEqual({
      eventDate: null,
      eventDateSource: null,
    });
  });
});
