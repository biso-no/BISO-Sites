import { describe, expect, test } from "bun:test";
import { hasNavAccess, ROLES } from "./roles";

const GENERAL_PUBLISHING_KEYS = [
  "portal.pages",
  "portal.news",
  "portal.events",
  "portal.shop",
  "portal.benefits",
  "portal.communications",
  "portal.documents",
] as const;

describe("general publishing navigation", () => {
  test("department members reach every general publishing surface", () => {
    for (const key of GENERAL_PUBLISHING_KEYS) {
      expect(hasNavAccess(key, [], true), key).toBe(true);
    }
  });

  test("users without any scope reach nothing", () => {
    for (const key of GENERAL_PUBLISHING_KEYS) {
      expect(hasNavAccess(key, [], false), key).toBe(false);
    }
  });
});

describe("jobs navigation", () => {
  test("HR members and global admins reach jobs", () => {
    expect(hasNavAccess("portal.jobs", [ROLES.HR], true)).toBe(true);
    expect(hasNavAccess("portal.jobs", [ROLES.GLOBAL_ADMIN], false)).toBe(true);
  });

  test("campus admins and plain department members do not reach jobs", () => {
    expect(hasNavAccess("portal.jobs", [], true)).toBe(false);
    expect(hasNavAccess("portal.jobs", [ROLES.CAMPUS_ADMIN], true)).toBe(false);
  });

  test("legacy jobs keys follow the same HR/global gate", () => {
    expect(hasNavAccess("jobs", [ROLES.CAMPUS_ADMIN], true)).toBe(false);
    expect(hasNavAccess("jobsApplications", [], true)).toBe(false);
    expect(hasNavAccess("jobs", [ROLES.HR], true)).toBe(true);
  });
});

describe("operational surfaces stay narrow", () => {
  test("shop settings remain global-admin only", () => {
    expect(hasNavAccess("shopSettings", [ROLES.CAMPUS_ADMIN], true)).toBe(
      false
    );
    expect(hasNavAccess("shopSettings", [ROLES.GLOBAL_ADMIN], false)).toBe(
      true
    );
  });

  test("benefit partner administration is not opened to departments", () => {
    expect(hasNavAccess("portal.benefitsPartners", [], true)).toBe(false);
  });
});
