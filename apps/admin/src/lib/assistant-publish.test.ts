import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { UserAuthContext } from "@/lib/authorization";

const publishBenefit = mock();

mock.module("server-only", () => ({}));

mock.module("@/lib/benefit-publish", () => ({ publishBenefit }));

const {
  applyConfirmedCreateFacts,
  assistantRoleSummary,
  canPublishContent,
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

describe("applyConfirmedCreateFacts", () => {
  test("a model-written status is replaced by the confirmed one", () => {
    const payload = { status: "published", title_no: "x" };
    expect(
      applyConfirmedCreateFacts("events", payload, { status: "draft" }).status
    ).toBe("draft");
    expect(
      applyConfirmedCreateFacts("news", {}, { status: "published" }).status
    ).toBe("published");
  });

  test("a payload campus that differs from the confirmed one is overwritten", () => {
    const result = applyConfirmedCreateFacts(
      "news",
      { campus_id: "2", campusId: "3", department: "d-x" },
      { campusId: "1", departmentId: "dept-it", status: "draft" }
    );
    expect(result.campus_id).toBe("1");
    expect(result.department_id).toBe("dept-it");
    expect(result).not.toHaveProperty("campusId");
    expect(result).not.toHaveProperty("department");
  });

  test("without confirmed values the payload's own are kept under the card's names", () => {
    const result = applyConfirmedCreateFacts(
      "shop",
      { campusId: "4", department: "d-1" },
      { status: "draft" }
    );
    expect(result.campus_id).toBe("4");
    expect(result.department_id).toBe("d-1");
  });

  test("benefits carry no department", () => {
    const result = applyConfirmedCreateFacts(
      "benefits",
      { department_id: "d-1" },
      { campusId: "1", departmentId: "d-2", status: "draft" }
    );
    expect(result.campus_id).toBe("1");
    expect(result.status).toBe("draft");
    expect(result).not.toHaveProperty("department_id");
  });
});
