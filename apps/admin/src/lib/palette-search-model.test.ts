import { describe, expect, test } from "bun:test";
import { Query } from "@repo/api";
import type { UserAuthContext } from "@/lib/authorization";
import {
  buildHitHref,
  canSearchDepartments,
  departmentScopeQueries,
  jobScopeQueries,
  pickTitle,
} from "./palette-search-model";

function makeCtx(overrides: Partial<UserAuthContext> = {}): UserAuthContext {
  return {
    campusNames: [],
    campusTeamIds: [],
    departmentNames: [],
    departmentTeamIds: [],
    email: null,
    managedCampuses: [],
    managedCampusIds: [],
    name: null,
    resolvedCampusIds: [],
    resolvedDepartmentIds: [],
    roles: [],
    userId: "u1",
    ...overrides,
  };
}

describe("jobScopeQueries", () => {
  test("global admin without campus filter sees everything", () => {
    expect(jobScopeQueries(makeCtx({ roles: ["globaladmin"] }))).toEqual([]);
  });

  test("global admin with active campus filters by campus relationship", () => {
    expect(
      jobScopeQueries(makeCtx({ activeCampusId: "1", roles: ["globaladmin"] }))
    ).toEqual([Query.equal("campus.$id", ["1"])]);
  });

  test("HR members filter by their campuses", () => {
    expect(
      jobScopeQueries(makeCtx({ resolvedCampusIds: ["1"], roles: ["hr"] }))
    ).toEqual([Query.equal("campus.$id", ["1"])]);
  });

  test("SECURITY: campus admins and department users fail closed", () => {
    for (const ctx of [
      makeCtx({ managedCampusIds: ["1", "2"], roles: ["campusadmin"] }),
      makeCtx({ resolvedDepartmentIds: ["d1"] }),
    ]) {
      const queries = jobScopeQueries(ctx);
      expect(queries).toHaveLength(1);
      expect(queries[0]).toContain("__no_scope_resolved__");
    }
  });

  test("SECURITY: unresolved scope fails closed", () => {
    const queries = jobScopeQueries(makeCtx());
    expect(queries).toHaveLength(1);
    expect(queries[0]).toContain("__no_scope_resolved__");
  });
});

describe("departmentScopeQueries", () => {
  test("campus admin filters by campus_id", () => {
    expect(
      departmentScopeQueries(
        makeCtx({ managedCampusIds: ["3"], roles: ["campusadmin"] })
      )
    ).toEqual([Query.equal("campus_id", ["3"])]);
  });

  test("SECURITY: unresolved scope fails closed", () => {
    expect(departmentScopeQueries(makeCtx())[0]).toContain(
      "__no_scope_resolved__"
    );
  });
});

describe("canSearchDepartments", () => {
  test("matches the portal departments navigation gate", () => {
    expect(canSearchDepartments(makeCtx({ roles: ["globaladmin"] }))).toBe(
      true
    );
    expect(canSearchDepartments(makeCtx({ roles: ["campusadmin"] }))).toBe(
      true
    );
    expect(
      canSearchDepartments(
        makeCtx({ departmentTeamIds: ["sg-app-dept-social"] })
      )
    ).toBe(false);
  });
});

describe("pickTitle", () => {
  test("prefers Norwegian, then English, then any, then fallback", () => {
    const rows = [
      { locale: "en", title: "English" },
      { locale: "no", title: "Norsk" },
    ];
    expect(pickTitle(rows, "fb")).toBe("Norsk");
    expect(pickTitle([{ locale: "en", title: "English" }], "fb")).toBe(
      "English"
    );
    expect(pickTitle([{ locale: "de", title: "Deutsch" }], "fb")).toBe(
      "Deutsch"
    );
    expect(pickTitle([], "fb")).toBe("fb");
    expect(pickTitle(null, "fb")).toBe("fb");
  });
});

describe("buildHitHref", () => {
  test("entities with detail routes deep-link, others fall back to lists", () => {
    expect(buildHitHref("jobs", "j1")).toBe("/jobs/j1");
    expect(buildHitHref("events", "e1")).toBe("/events/e1");
    expect(buildHitHref("news", "n1")).toBe("/news/n1");
    expect(buildHitHref("pages", "p1")).toBe("/pages/p1");
    expect(buildHitHref("products", "w1")).toBe("/shop/w1");
    // no [id] routes exist for these — verified against the route tree
    expect(buildHitHref("departments", "d1")).toBe("/departments");
    expect(buildHitHref("orders", "o1")).toBe("/shop");
  });
});
