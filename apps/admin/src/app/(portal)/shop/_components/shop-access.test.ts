import { describe, expect, test } from "bun:test";
import { canViewShopOperations, ROLES } from "@/lib/roles";

describe("canViewShopOperations", () => {
  test("campus and global admins see order operations", () => {
    expect(canViewShopOperations([ROLES.GLOBAL_ADMIN])).toBe(true);
    expect(canViewShopOperations([ROLES.CAMPUS_ADMIN])).toBe(true);
  });

  test("department product authors never see order operations", () => {
    expect(canViewShopOperations([])).toBe(false);
    expect(canViewShopOperations([ROLES.HR])).toBe(false);
  });
});
