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

  // Every hit the palette surfaces now deep-links straight into
  // /departments/[id] (buildHitHref), so a plain department member must be
  // scoped by the departments they can actually manage — not by campus,
  // which would surface colleagues' departments and 404 on click. Mirrors
  // canManageDepartment's third branch in lib/departments.ts.
  test("plain department member filters by their own resolved department ids, not campus", () => {
    expect(
      departmentScopeQueries(
        makeCtx({ resolvedCampusIds: ["3"], resolvedDepartmentIds: ["d1"] })
      )
    ).toEqual([Query.equal("$id", ["d1"])]);
  });

  test("SECURITY: unresolved scope fails closed", () => {
    expect(departmentScopeQueries(makeCtx())[0]).toContain(
      "__no_scope_resolved__"
    );
  });
});

describe("canSearchDepartments", () => {
  test("admins and department members can search departments (matches the portal.departments nav gate)", () => {
    expect(canSearchDepartments(makeCtx({ roles: ["globaladmin"] }))).toBe(
      true
    );
    expect(canSearchDepartments(makeCtx({ roles: ["campusadmin"] }))).toBe(
      true
    );
    // Department members can search departments too: /departments is open to
    // any SG-App-Dept-* member, not just admins — they can manage their own.
    expect(
      canSearchDepartments(
        makeCtx({ departmentTeamIds: ["sg-app-dept-social"] })
      )
    ).toBe(true);
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
    // /departments/[id] exists now (this PR) — departments deep-link too.
    expect(buildHitHref("departments", "308")).toBe("/departments/308");
    // orders genuinely have no detail route — guard against an over-broad edit.
    expect(buildHitHref("orders", "o1")).toBe("/shop");
  });
});
