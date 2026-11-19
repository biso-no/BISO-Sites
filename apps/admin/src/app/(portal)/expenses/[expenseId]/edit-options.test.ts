import { describe, expect, test } from "bun:test";
import type {
  FinagoProjects,
  FinagoProjectUsage,
} from "@repo/api/types/appwrite";
import { projectOptions } from "./edit-options";

const project = (
  id: string,
  name: string,
  year: number | null,
  active = true
) =>
  ({
    $id: id,
    active,
    name,
    project_id: id,
    series: name.toLowerCase(),
    year,
  }) as FinagoProjects;

const usage = (projectId: string, departmentId: string) =>
  ({
    department_id: departmentId,
    last_line_date: "2026-05-01",
    project_id: projectId,
  }) as FinagoProjectUsage;

describe("projectOptions", () => {
  test("options list the department's candidates first", () => {
    const options = projectOptions({
      departmentId: "d1",
      projects: [
        project("a", "Aaa 2026", 2026),
        project("b", "Bbb 2026", 2026),
        project("c", "Ccc 2026", 2026),
        project("old", "Old 2019", 2019, false),
      ],
      today: "2026-11-19",
      usage: [usage("c", "d1"), usage("a", "other")],
    });
    expect(options).toEqual([
      { name: "Ccc 2026", projectId: "c", suggested: true },
      { name: "Aaa 2026", projectId: "a", suggested: false },
      { name: "Bbb 2026", projectId: "b", suggested: false },
    ]);
  });

  test("without a department everything is a plain option", () => {
    const options = projectOptions({
      departmentId: null,
      projects: [project("a", "Aaa 2026", 2026)],
      today: "2026-11-19",
      usage: [],
    });
    expect(options).toEqual([
      { name: "Aaa 2026", projectId: "a", suggested: false },
    ]);
  });

  test("æ, ø and å sort after z", () => {
    const options = projectOptions({
      departmentId: null,
      projects: [
        project("1", "Åpning 2026", 2026),
        project("2", "Zebra 2026", 2026),
        project("3", "Ærlig 2026", 2026),
        project("4", "Aaa 2026", 2026),
      ],
      today: "2026-11-19",
      usage: [],
    });
    expect(options.map((o) => o.projectId)).toEqual(["4", "2", "3", "1"]);
  });
});
