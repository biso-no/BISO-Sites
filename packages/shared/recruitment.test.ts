import { describe, expect, it } from "vitest";
import { buildRecruitmentStaffRowPermissions } from "./recruitment";

describe("buildRecruitmentStaffRowPermissions", () => {
  it("grants read/update/delete to admin and HR only", () => {
    expect(buildRecruitmentStaffRowPermissions()).toEqual([
      'read("team:admin")',
      'update("team:admin")',
      'delete("team:admin")',
      'read("team:sg-app-dept-hr")',
      'update("team:sg-app-dept-hr")',
      'delete("team:sg-app-dept-hr")',
    ]);
  });

  it("never includes campus or department teams", () => {
    const perms = buildRecruitmentStaffRowPermissions().join(" ");
    expect(perms).not.toContain("sg-app-campus-");
    expect(perms).not.toContain("sg-app-dept-operationsunit");
  });
});
