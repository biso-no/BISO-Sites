import type { Jobs } from "@repo/api/types/appwrite";
import { describe, expect, it, vi } from "vitest";
import {
  buildRecruitmentStaffRowPermissions,
  buildRecruitmentVacancy,
  getRecruitmentJobById,
} from "./recruitment";

describe("buildRecruitmentStaffRowPermissions", () => {
  it("grants read/update/delete to Operations Unit and HR only", () => {
    expect(buildRecruitmentStaffRowPermissions()).toEqual([
      'read("team:sg-app-dept-operationsunit")',
      'update("team:sg-app-dept-operationsunit")',
      'delete("team:sg-app-dept-operationsunit")',
      'read("team:sg-app-dept-hr")',
      'update("team:sg-app-dept-hr")',
      'delete("team:sg-app-dept-hr")',
    ]);
  });

  it("never includes campus, unrelated department, or literal admin teams", () => {
    const perms = buildRecruitmentStaffRowPermissions().join(" ");
    expect(perms).not.toContain("sg-app-campus-");
    expect(perms).not.toContain("team:admin");
    expect(perms).not.toContain("sg-app-dept-marketing");
  });
});

describe("buildRecruitmentVacancy", () => {
  it("caps an imported translation excerpt at the metadata limit", () => {
    const importedExcerpt = "x".repeat(500);
    const job = {
      $createdAt: "2026-08-19T00:00:00.000Z",
      $id: "wpjob1",
      $updatedAt: "2026-08-19T00:00:00.000Z",
      application_deadline: null,
      auto_screen: true,
      campus: null,
      campus_id: "campus-oslo",
      custom_questions: null,
      department: null,
      department_id: null,
      interview_template: null,
      metadata: null,
      screening_rubric: null,
      slug: "imported-job",
      status: "published",
      translations: [
        {
          $id: "translation-1",
          additional_fields: null,
          description: "<p>Job description</p>",
          locale: "no",
          short_description: importedExcerpt,
          title: "Imported job",
        },
      ],
    } as unknown as Jobs;

    const vacancy = buildRecruitmentVacancy(job);

    expect(vacancy.metadata.short_description).toBe("x".repeat(280));
    expect(vacancy.translations[0]?.short_description).toBe("x".repeat(280));
  });
});

describe("getRecruitmentJobById", () => {
  it("returns null only when the row does not exist", async () => {
    const db = {
      getRow: vi
        .fn()
        .mockRejectedValue(
          Object.assign(new Error("Row not found"), { code: 404 })
        ),
    };
    await expect(
      getRecruitmentJobById(db as never, "missing")
    ).resolves.toBeNull();
  });

  it("rethrows timeouts instead of reporting the vacancy as missing", async () => {
    const timeout = Object.assign(new Error("timed out"), {
      type: "appwrite_timeout",
    });
    const db = {
      getRow: vi.fn().mockRejectedValue(timeout),
    };
    await expect(getRecruitmentJobById(db as never, "job-1")).rejects.toBe(
      timeout
    );
  });
});
