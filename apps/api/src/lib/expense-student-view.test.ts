import { describe, expect, it } from "vitest";
import { withoutProject, withoutProjects } from "./expense-student-view";

const WITH_PROJECT = {
  $id: "a1",
  amount: 5,
  project_confidence: 0.8,
  project_id: "p1",
  project_name: "Fadderuke 2026",
  project_source: "ai",
};
const STRIPPED = {
  $id: "a1",
  amount: 5,
  project_confidence: null,
  project_id: null,
  project_name: null,
  project_source: null,
};

describe("withoutProject", () => {
  it("nulls every project field and keeps the rest", () => {
    expect(withoutProject(WITH_PROJECT)).toEqual(STRIPPED);
  });
});

describe("withoutProjects", () => {
  it("strips each attachment of the list", () => {
    const row = { $id: "e1", expenseAttachments: [WITH_PROJECT, WITH_PROJECT] };
    expect(withoutProjects(row)).toEqual({
      $id: "e1",
      expenseAttachments: [STRIPPED, STRIPPED],
    });
  });

  it("leaves a row without attachments unchanged", () => {
    const row: { $id: string; expenseAttachments?: unknown } = { $id: "e1" };
    expect(withoutProjects(row)).toBe(row);
  });

  it("leaves ids-only attachments alone", () => {
    expect(
      withoutProjects({ expenseAttachments: ["a1", null] as never })
    ).toEqual({ expenseAttachments: ["a1", null] });
  });
});
