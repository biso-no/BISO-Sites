import { describe, expect, test } from "bun:test";
import { resolveApproverTeamId } from "./campus-constants";
import {
  buildContentRowPermissions,
  buildContentTranslationPermissions,
} from "./utils";

const OPS_TEAM = "sg-app-dept-operationsunit";

describe("Operations Unit Appwrite backstop", () => {
  test("draft content rows are service-only — no team ACL at all", () => {
    const permissions = buildContentRowPermissions({
      campusTeam: "sg-app-campus-oslo",
      deptTeam: "sg-app-dept-marketing",
      status: "draft",
    });

    expect(permissions).toEqual([]);
  });

  test("draft content translations are service-only — no team ACL at all", () => {
    const permissions = buildContentTranslationPermissions({
      readTeams: ["sg-app-campus-oslo"],
      status: "draft",
      writeTeams: ["sg-app-dept-marketing"],
    });

    expect(permissions).toEqual([]);
  });

  test("approval routing falls back to Operations Unit", () => {
    expect(resolveApproverTeamId("jobs.publish")).toBe(OPS_TEAM);
    expect(resolveApproverTeamId("pages.publish")).toBe(OPS_TEAM);
    expect(resolveApproverTeamId("pages.publish", "5")).toBe(OPS_TEAM);
    expect(resolveApproverTeamId("pages.publish", "1")).toBe(
      "sg-app-dept-ledelsenoslo"
    );
  });
});
