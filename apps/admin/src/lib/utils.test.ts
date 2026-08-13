import { describe, expect, test } from "bun:test";
import { Permission, Role } from "@repo/api";
import {
  buildContentRowPermissions,
  buildContentTranslationPermissions,
} from "./utils";

const MUTATION_PATTERN = /(create|update|delete)\(/;

describe("buildContentRowPermissions", () => {
  test("non-published rows are service-only", () => {
    expect(buildContentRowPermissions({ status: "draft" })).toEqual([]);
    expect(buildContentRowPermissions({ status: "archived" })).toEqual([]);
    expect(buildContentRowPermissions({ status: "scheduled" })).toEqual([]);
  });

  test("published public rows are readable by anyone", () => {
    expect(buildContentRowPermissions({ status: "published" })).toEqual([
      Permission.read(Role.any()),
    ]);
  });

  test("published member rows are readable by the members team", () => {
    expect(
      buildContentRowPermissions({
        audience: "members",
        status: "published",
      })
    ).toEqual([Permission.read(Role.team("biso-members"))]);
  });

  test("SECURITY: no result ever contains an authoring permission", () => {
    const cases = [
      buildContentRowPermissions({ status: "draft" }),
      buildContentRowPermissions({ status: "published" }),
      buildContentRowPermissions({
        audience: "members",
        campusTeam: "sg-app-campus-oslo",
        deptTeam: "sg-app-dept-marketing",
        status: "published",
      }),
      buildContentRowPermissions({
        campusTeam: "sg-app-campus-oslo",
        deptTeam: "sg-app-dept-marketing",
        status: "draft",
      }),
    ];
    for (const permissions of cases) {
      for (const permission of permissions) {
        expect(permission).not.toMatch(MUTATION_PATTERN);
        expect(permission).not.toContain("sg-app-");
      }
    }
  });
});

describe("buildContentTranslationPermissions", () => {
  test("translation visibility matches the parent", () => {
    expect(
      buildContentTranslationPermissions({
        status: "published",
        writeTeams: [],
      })
    ).toEqual([Permission.read(Role.any())]);
    expect(
      buildContentTranslationPermissions({
        audience: "members",
        status: "published",
        writeTeams: [],
      })
    ).toEqual([Permission.read(Role.team("biso-members"))]);
    expect(
      buildContentTranslationPermissions({ status: "draft", writeTeams: [] })
    ).toEqual([]);
  });

  test("SECURITY: legacy team and owner inputs never enter the ACL", () => {
    const permissions = buildContentTranslationPermissions({
      ownerUserId: "user-1",
      readTeams: ["sg-app-campus-oslo"],
      status: "published",
      writeTeams: ["sg-app-dept-marketing"],
    });
    expect(permissions).toEqual([Permission.read(Role.any())]);
  });
});
