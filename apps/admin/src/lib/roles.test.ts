import { describe, expect, test } from "bun:test";
import {
  canManageAccounting,
  hasNavAccess,
  NAV_ACCESS,
  type NavKey,
  ROLES,
} from "./roles";

const GENERAL_PUBLISHING_KEYS = [
  "portal.pages",
  "portal.news",
  "portal.events",
  "portal.shop",
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

describe("benefits navigation", () => {
  test("department members do not reach benefits", () => {
    expect(hasNavAccess("portal.benefits", [], true)).toBe(false);
  });

  test("benefits editors reach benefits and partners", () => {
    for (const key of ["portal.benefits", "portal.benefitsPartners"] as const) {
      expect(hasNavAccess(key, [ROLES.BENEFITS_EDITOR], false), key).toBe(true);
    }
  });

  test("every benefits nav key admits benefits editors", () => {
    const keys = (Object.keys(NAV_ACCESS) as NavKey[]).filter((key) =>
      key.toLowerCase().includes("benefit")
    );
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      expect(hasNavAccess(key, [ROLES.BENEFITS_EDITOR], false), key).toBe(true);
    }
  });
});

describe("communications navigation", () => {
  test("department members do not reach communications", () => {
    expect(hasNavAccess("portal.communications", [], true)).toBe(false);
  });

  test("campus and global admins reach communications", () => {
    expect(
      hasNavAccess("portal.communications", [ROLES.CAMPUS_ADMIN], true)
    ).toBe(true);
    expect(
      hasNavAccess("portal.communications", [ROLES.GLOBAL_ADMIN], false)
    ).toBe(true);
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

describe("canManageAccounting", () => {
  test("allows global and campus admins", () => {
    expect(canManageAccounting([ROLES.GLOBAL_ADMIN])).toBe(true);
    expect(canManageAccounting([ROLES.CAMPUS_ADMIN])).toBe(true);
  });

  test("denies department members", () => {
    expect(canManageAccounting(["department"])).toBe(false);
    expect(hasNavAccess("portal.shopAccounting", ["department"], true)).toBe(
      false
    );
  });

  test("opens the accounting page to campus admins", () => {
    expect(
      hasNavAccess("portal.shopAccounting", [ROLES.CAMPUS_ADMIN], false)
    ).toBe(true);
  });
});
