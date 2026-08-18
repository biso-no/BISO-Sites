import { describe, expect, test } from "bun:test";
import {
  buildJobPermissions,
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
