import { describe, expect, test } from "bun:test";
import {
  buildJobPermissions,
  buildOrderPermissions,
  buildPublicContentPermissions,
} from "./permissions";

describe("buildPublicContentPermissions", () => {
  test("grants public read to published content", () => {
    expect(buildPublicContentPermissions("published")).toEqual(['read("any")']);
  });

  test("grants nothing to draft content", () => {
    expect(buildPublicContentPermissions("draft")).toEqual([]);
  });

  test("grants nothing to archived content", () => {
    expect(buildPublicContentPermissions("archived")).toEqual([]);
  });
});

describe("buildJobPermissions", () => {
  test("published jobs are publicly readable", () => {
    expect(buildJobPermissions("published")).toContain('read("any")');
  });

  test("closed jobs are not publicly readable", () => {
    expect(buildJobPermissions("closed")).not.toContain('read("any")');
  });

  test("closed jobs still carry the staff grants", () => {
    expect(buildJobPermissions("closed").length).toBeGreaterThan(0);
  });

  test("does not emit duplicate permission strings", () => {
    const permissions = buildJobPermissions("published");

    expect(new Set(permissions).size).toBe(permissions.length);
  });
});

describe("buildOrderPermissions", () => {
  test("grants the matched buyer read access to their own order", () => {
    const permissions = buildOrderPermissions("user-abc");

    expect(permissions).toContain('read("user:user-abc")');
  });

  test("grants staff read/update/delete to a matched buyer's order", () => {
    const permissions = buildOrderPermissions("user-abc");

    expect(permissions).toContain('read("team:sg-app-dept-operationsunit")');
    expect(permissions).toContain('update("team:sg-app-dept-operationsunit")');
    expect(permissions).toContain('delete("team:sg-app-dept-operationsunit")');
  });

  test("an unmatched buyer gets only the staff grants, never public read", () => {
    const permissions = buildOrderPermissions(null);

    expect(permissions).not.toContain('read("any")');
    expect(permissions).toEqual([
      'read("team:sg-app-dept-operationsunit")',
      'update("team:sg-app-dept-operationsunit")',
      'delete("team:sg-app-dept-operationsunit")',
    ]);
  });
});
