import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Permission, Role } from "@repo/api";
import {
  buildContentRowPermissions,
  buildContentTranslationPermissions,
  sanitizeRedirectTarget,
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

describe("sanitizeRedirectTarget", () => {
  const original = process.env.NEXT_PUBLIC_DOCS_URL;
  beforeEach(() => {
    process.env.NEXT_PUBLIC_DOCS_URL = "https://docs.biso.no";
  });
  afterEach(() => {
    if (original === undefined) {
      Reflect.deleteProperty(process.env, "NEXT_PUBLIC_DOCS_URL");
    } else {
      process.env.NEXT_PUBLIC_DOCS_URL = original;
    }
  });

  test("keeps relative paths and rejects unsafe relative forms", () => {
    expect(sanitizeRedirectTarget("/pages/1?x=2")).toBe("/pages/1?x=2");
    expect(sanitizeRedirectTarget("%2Fpages%2F1")).toBe("/pages/1");
    expect(sanitizeRedirectTarget("//evil.com")).toBe("/");
    expect(sanitizeRedirectTarget("/\\evil.com")).toBe("/");
    expect(sanitizeRedirectTarget("https://evil.com")).toBe("/");
    expect(sanitizeRedirectTarget(null)).toBe("/");
    expect(sanitizeRedirectTarget("")).toBe("/");
  });

  test("rejects control characters and whitespace in relative paths", () => {
    for (const bad of [
      "/%09/evil.com",
      "%2F%09%2Fevil.com",
      "/\t/evil.com",
      "/\t\\evil.com",
      "/%09%5Cevil.com",
      "/%0A/evil.com",
      "/%0D/evil.com",
      "/%00",
    ]) {
      expect(sanitizeRedirectTarget(bad)).toBe("/");
    }
  });

  test("accepts the docs origin with path and query preserved", () => {
    const url = "https://docs.biso.no/it/guide?a=1%202#top";
    expect(sanitizeRedirectTarget(url)).toBe(url);
    expect(sanitizeRedirectTarget(encodeURIComponent(url))).toBe(url);
    expect(sanitizeRedirectTarget("https://docs.biso.no")).toBe(
      "https://docs.biso.no"
    );
  });

  test("rejects lookalike and malformed docs URLs", () => {
    for (const bad of [
      "https://docs.biso.no.evil.com/x",
      "https://docs.biso.no@evil.com/",
      "https://evil.com@docs.biso.no/",
      "//docs.biso.no/x",
      "https:/docs.biso.no",
      "https:\\\\docs.biso.no",
      "https://docs.biso.no\\@evil.com",
      "http://docs.biso.no/x",
      "https://docs.biso.no:8443/x",
      "javascript:alert(1)",
      "https://docs.biso.no/x%00",
      "https://docs.biso.no/x%0Ay",
    ]) {
      expect(sanitizeRedirectTarget(bad)).toBe("/");
    }
  });

  test("accepts no absolute URL when the env var is unset or invalid", () => {
    Reflect.deleteProperty(process.env, "NEXT_PUBLIC_DOCS_URL");
    expect(sanitizeRedirectTarget("https://docs.biso.no/x")).toBe("/");
    process.env.NEXT_PUBLIC_DOCS_URL = "not a url";
    expect(sanitizeRedirectTarget("https://docs.biso.no/x")).toBe("/");
  });
});
