import { describe, expect, test } from "bun:test";
import {
  filterGroups,
  groupProjects,
  type ProjectView,
} from "./projects-model";

const project = (data: Partial<ProjectView>): ProjectView => ({
  departments: [],
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
