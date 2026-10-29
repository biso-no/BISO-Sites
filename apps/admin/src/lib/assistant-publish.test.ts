import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { UserAuthContext } from "@/lib/authorization";

const publishBenefit = mock();

mock.module("server-only", () => ({}));

mock.module("@/lib/benefit-publish", () => ({ publishBenefit }));

const {
  assistantRoleSummary,
  canPublishContent,
  createdContentNeedsPublish,
  dropBenefitDepartment,
  publishBenefitContent,
  benefitUpdateFromAssistant,
  withoutBenefitCode,
} = await import("./assistant-publish");

const ctx = (overrides: Partial<UserAuthContext>): UserAuthContext => ({
  activeCampusId: undefined,
  campusNames: [],
  campusTeamIds: [],
  departmentNames: [],
  departmentTeamIds: [],
  email: "u@example.com",
  managedCampuses: [],
  managedCampusIds: [],
  name: "U",
  resolvedCampusIds: [],
  resolvedDepartmentIds: [],
  roles: [],
  userId: "u1",
  ...overrides,
});

describe("publishBenefitContent", () => {
  beforeEach(() => publishBenefit.mockReset());

  test("publishes through publishBenefit", async () => {
    publishBenefit.mockResolvedValue({ data: "b1" });
    expect(await publishBenefitContent("b1")).toEqual({ data: "b1" });
    expect(publishBenefit).toHaveBeenCalledWith("b1");
  });

  test("returns the error from publishBenefit", async () => {
    publishBenefit.mockResolvedValue({ error: "nope" });
    expect(await publishBenefitContent("b1")).toEqual({ error: "nope" });
  });
});

describe("dropBenefitDepartment", () => {
  test("removes department keys only", () => {
    expect(
      dropBenefitDepartment({
        department: "d",
        departmentId: "d",
        department_id: "d",
        title: "t",
      })
    ).toEqual({ title: "t" });
  });
});

describe("withoutBenefitCode", () => {
  test("drops the code and keeps everything else", () => {
    const view = withoutBenefitCode({
      $id: "b1",
      editable: true,
      redemption_type: "code",
      redemption_value: "BISO20",
      title_nb: "Rabatt",
    });
    expect(view).toEqual({
      $id: "b1",
      editable: true,
      redemption_type: "code",
      title_nb: "Rabatt",
    });
    expect("redemption_value" in view).toBe(false);
  });
});

describe("canPublishContent", () => {
  test("benefits editor may publish benefits on any campus", () => {
    const editor = ctx({ roles: ["benefitseditor"] });
    expect(canPublishContent(editor, "benefits", null)).toBe(true);
    expect(canPublishContent(editor, "news", "c1")).toBe(false);
  });

  test("campus admin keeps campus scoping", () => {
    const admin = ctx({ roles: ["campusadmin"], managedCampusIds: ["c1"] });
    expect(canPublishContent(admin, "news", "c1")).toBe(true);
    expect(canPublishContent(admin, "news", "c2")).toBe(false);
  });
});

describe("assistantRoleSummary", () => {
  test("benefits editor summary", () => {
    expect(assistantRoleSummary(ctx({ roles: ["benefitseditor"] }))).toContain(
      "Benefits editor"
    );
  });
  test("admins keep their summary", () => {
    expect(
      assistantRoleSummary(ctx({ roles: ["globaladmin", "benefitseditor"] }))
    ).toContain("Global admin");
    expect(
      assistantRoleSummary(
        ctx({
          roles: ["campusadmin", "benefitseditor"],
          managedCampuses: ["Oslo"],
        })
      )
    ).toContain("Campus admin");
  });
});

describe("benefitUpdateFromAssistant", () => {
  test("never carries a code, so an empty one cannot clear the stored code", () => {
    for (const empty of ["", null]) {
      const update = benefitUpdateFromAssistant({
        redemption_value: empty,
        status: "draft",
      });
      expect(update).toEqual({ status: "draft" });
      expect(update).not.toHaveProperty("redemption_value");
    }
  });
});

describe("canPublishContent for jobs", () => {
  test("HR and global admins publish vacancies directly", () => {
    for (const roles of [["hr"], ["hradmin"], ["globaladmin"]]) {
      expect(canPublishContent(ctx({ roles }), "jobs", "c1")).toBe(true);
    }
  });

  test("a campus admin's vacancy publish needs approval", () => {
    const campusAdmin = ctx({
      managedCampusIds: ["c1"],
      roles: ["campusadmin"],
    });
    expect(canPublishContent(campusAdmin, "jobs", "c1")).toBe(false);
    expect(canPublishContent(campusAdmin, "news", "c1")).toBe(true);
  });
});

describe("createdContentNeedsPublish", () => {
  test("a created vacancy is already live, other domains publish after create", () => {
    expect(createdContentNeedsPublish("jobs")).toBe(false);
    expect(createdContentNeedsPublish("news")).toBe(true);
  });
});
