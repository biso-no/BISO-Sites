import { describe, expect, mock, test } from "bun:test";
import { hasNavAccess } from "@/lib/roles";

// `mock.module` is process-wide: every export stays, and only the session
// read is replaced. The gate is the real one, driven by these roles.
let roles: string[] = [];
const NOT_FOUND = "NEXT_NOT_FOUND";

const actualAuthorization = await import("@/lib/authorization");
mock.module("@/lib/authorization", () => ({
  ...actualAuthorization,
  requireNavAccess: (key: Parameters<typeof hasNavAccess>[0]) => {
    if (!(roles.includes("globaladmin") || hasNavAccess(key, roles, false))) {
      throw new Error(NOT_FOUND);
    }
    return Promise.resolve({ roles });
  },
}));
const loaded: string[] = [];
mock.module("../../_actions/membership-texts", () => ({
  loadMembershipTexts: () => {
    loaded.push("load");
    return Promise.resolve([]);
  },
  resetMembershipSpot: () => Promise.resolve({ data: true }),
  saveMembershipSpot: () => Promise.resolve({ data: true }),
}));
const actualIntl = await import("next-intl/server");
mock.module("next-intl/server", () => ({
  ...actualIntl,
  getLocale: () => Promise.resolve("no"),
  getTranslations: () => Promise.resolve((key: string) => key),
}));

const { default: BenefitTextsPage } = await import("./page");

describe("Tekster om medlemskap page", () => {
  test("a campus admin does not get in, and nothing is loaded", async () => {
    roles = ["campusadmin"];
    loaded.length = 0;
    await expect(BenefitTextsPage()).rejects.toThrow(NOT_FOUND);
    expect(loaded).toHaveLength(0);
  });

  test("a benefits editor does", async () => {
    roles = ["benefitseditor"];
    loaded.length = 0;
    await BenefitTextsPage();
    expect(loaded).toEqual(["load"]);
  });
});
