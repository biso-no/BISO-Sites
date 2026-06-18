import { describe, expect, it } from "vitest";
import { buildRecruitmentStaffRowPermissions } from "./recruitment";

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
