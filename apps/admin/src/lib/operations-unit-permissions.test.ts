import { describe, expect, test } from "bun:test";
import { resolveApproverTeamId } from "./campus-constants";
import {
  buildContentRowPermissions,
  buildContentTranslationPermissions,
} from "./utils";

const OPS_TEAM = "sg-app-dept-operationsunit";

describe("Operations Unit Appwrite backstop", () => {
  test("content rows use Operations Unit instead of a literal admin team", () => {
    const permissions = buildContentRowPermissions({
      campusTeam: "sg-app-campus-oslo",
      deptTeam: "sg-app-dept-marketing",
      status: "draft",
    });

    expect(permissions).toContain(`read("team:${OPS_TEAM}")`);
    expect(permissions).toContain(`update("team:${OPS_TEAM}")`);
    expect(permissions).toContain(`delete("team:${OPS_TEAM}")`);
    expect(permissions.join(" ")).not.toContain("team:admin");
  });

  test("content translations use Operations Unit read access instead of a literal admin team", () => {
    const permissions = buildContentTranslationPermissions({
      readTeams: ["sg-app-campus-oslo"],
      status: "draft",
      writeTeams: ["sg-app-dept-marketing"],
    });

    expect(permissions).toContain(`read("team:${OPS_TEAM}")`);
    expect(permissions.join(" ")).not.toContain("team:admin");
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
