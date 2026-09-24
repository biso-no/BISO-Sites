/**
 * Department scope with no campus resolved.
 *
 * Department access is campus *and* department — `canReadRow` enforces both,
 * and refuses every campus-bearing row when the principal resolved no campus.
 * `scopeQueries` used to emit the department predicate alone in that state, so
 * a listing returned that department's rows at every campus while the
 * single-row check refused each of them. The list must not be the looser gate.
 *
 * The state is reachable: a user can hold a department team whose companion
 * campus team is missing, and `resolveDepartmentIds` can still resolve the
 * department by scanning campuses.
 */

import { describe, expect, test } from "bun:test";
import { createContentService } from "../services/content";
import {
  createFakeBackend,
  type FakeTables,
  makePrincipal,
} from "../testing/index";
import { canReadRow, describeScope, scopeQueries } from "./scope";

const LINKS = {
  web: (path: string) => `https://biso.no${path}`,
  admin: (path: string) => `https://admin.biso.no${path}`,
};

/** A department team with no companion campus membership. */
const CAMPUSLESS_DEPARTMENT_MEMBER = () =>
  makePrincipal({
    userId: "dept-nocampus",
    roles: [],
    campusNames: [],
    departmentNames: ["ESN Oslo"],
    departmentTeamIds: ["sg-app-dept-esnoslo"],
    resolvedCampusIds: [],
    resolvedDepartmentIds: ["dept-esn-oslo"],
    profile: "staff",
  });

const CAMPUS_SCOPED = {
  campusField: "campus.$id",
  departmentField: "department.$id",
};

describe("a department member who resolved no campus", () => {
  test("the row check refuses a campus-bearing row of their own department", () => {
    // This is the behaviour the query has to agree with, not a new rule.
    expect(
      canReadRow(CAMPUSLESS_DEPARTMENT_MEMBER(), "2", "dept-esn-oslo")
    ).toBe(false);
  });

  test("so the list query matches nothing rather than every campus", () => {
    const queries = scopeQueries(CAMPUSLESS_DEPARTMENT_MEMBER(), CAMPUS_SCOPED);
    // One filter, and it is the no-match one — not a bare department predicate.
    expect(queries).toHaveLength(1);
    expect(queries[0]).not.toContain("dept-esn-oslo");
  });

  test("and the scope summary says so instead of naming the departments", () => {
    const scope = describeScope(CAMPUSLESS_DEPARTMENT_MEMBER(), CAMPUS_SCOPED);
    expect(scope.campusIds).toEqual([]);
    expect(scope.summary).toContain("No rows");
  });

  test("end to end: another campus's drafts stay out of a content search", async () => {
    const tables: FakeTables = {
      news: [
        {
          $id: "bergen-draft",
          $updatedAt: "2026-01-01T00:00:00.000Z",
          slug: "bergen-draft",
          status: "draft",
          campus_id: "2",
          campus: { $id: "2" },
          department_id: "dept-esn-oslo",
          department: { $id: "dept-esn-oslo" },
        },
      ],
      content_translations: [],
    };
    const found = await createContentService(
      createFakeBackend({ tables }),
      LINKS
    ).search(CAMPUSLESS_DEPARTMENT_MEMBER(), {
      domain: "news",
      limit: 20,
      offset: 0,
    });
    expect(found.rows).toEqual([]);
  });
});

describe("a department member who did resolve a campus is unaffected", () => {
  test("still gets both predicates", () => {
    const principal = makePrincipal({
      userId: "dept-1",
      roles: [],
      campusNames: ["Oslo"],
      departmentNames: ["ESN Oslo"],
      departmentTeamIds: ["sg-app-dept-esnoslo"],
      resolvedCampusIds: ["1"],
      resolvedDepartmentIds: ["dept-esn-oslo"],
      profile: "staff",
    });
    expect(scopeQueries(principal, CAMPUS_SCOPED)).toHaveLength(2);
  });
});
