/**
 * Which column authorizes a content search.
 *
 * `apps/admin` answers this once, in `content-authorization.ts`:
 * `applyContentRelationshipScopeQueries` scopes on `campus.$id` and
 * `department.$id`, and `getContentOwnership` states the rule its companion
 * follows — "relationship values win; `legacyFallback` exposes the scalar
 * columns only for rows that predate the relationship backfill (repair
 * rollout window)".
 *
 * This package scoped on the scalars instead, which has two consequences and
 * one test each below. During the repair window the two can disagree, and the
 * scalar is the stale one; and a table with a `department` relationship but no
 * `department_id` column looked like a table with no department at all.
 */

import { describe, expect, test } from "bun:test";
import {
  CAMPUS_ADMIN,
  createFakeBackend,
  DEPARTMENT_MEMBER,
  type FakeTables,
} from "../testing/index";
import { createContentService } from "./content";

const LINKS = {
  web: (path: string) => `https://biso.no${path}`,
  admin: (path: string) => `https://admin.biso.no${path}`,
};

function service(tables: FakeTables) {
  return createContentService(createFakeBackend({ tables }), LINKS);
}

describe("a repair-window row is authorized by its relationship", () => {
  /**
   * Two news rows mid-backfill. Each has a scalar and a relationship, and they
   * disagree — which is the state `legacyFallback` exists for.
   */
  function midBackfill(): FakeTables {
    return {
      news: [
        {
          $id: "moved-away",
          $updatedAt: "2026-01-02T00:00:00.000Z",
          slug: "moved-away",
          status: "draft",
          // Stale scalar still says Oslo; the row now belongs to Bergen.
          campus_id: "1",
          campus: { $id: "2" },
          department_id: "dept-b",
          department: { $id: "dept-b" },
        },
        {
          $id: "moved-here",
          $updatedAt: "2026-01-01T00:00:00.000Z",
          slug: "moved-here",
          status: "draft",
          // Stale scalar still says Bergen; the row now belongs to Oslo.
          campus_id: "2",
          campus: { $id: "1" },
          department_id: "dept-a",
          department: { $id: "dept-a" },
        },
      ],
      content_translations: [],
    };
  }

  test("a draft that moved away is no longer visible to its old campus", async () => {
    const found = await service(midBackfill()).search(
      CAMPUS_ADMIN("Oslo", "1"),
      {
        domain: "news",
        limit: 20,
        offset: 0,
      }
    );
    expect(found.rows.map((row) => row.id)).not.toContain("moved-away");
  });

  test("a draft that moved in is visible to its new campus", async () => {
    // The same fix in the other direction: scoping on the stale scalar also
    // *hid* a row the caller now owns.
    const found = await service(midBackfill()).search(
      CAMPUS_ADMIN("Oslo", "1"),
      {
        domain: "news",
        limit: 20,
        offset: 0,
      }
    );
    expect(found.rows.map((row) => row.id)).toEqual(["moved-here"]);
  });
});

describe("a table with no department column still has a department", () => {
  /**
   * `documents` and `campus_benefits` carry a `department` relationship and no
   * `department_id` scalar. Scoping by the scalar made the field null, which
   * `scopeQueries` fails closed on — so a department member saw none of their
   * own department's documents.
   */
  function documentsOf(departmentId: string): FakeTables {
    return {
      documents: [
        {
          $id: "ours",
          $updatedAt: "2026-01-02T00:00:00.000Z",
          title: "Ours",
          status: "draft",
          campus_id: "1",
          campus: { $id: "1" },
          department: { $id: departmentId },
        },
        {
          $id: "theirs",
          $updatedAt: "2026-01-01T00:00:00.000Z",
          title: "Theirs",
          status: "draft",
          campus_id: "1",
          campus: { $id: "1" },
          department: { $id: "dept-someone-else" },
        },
      ],
    };
  }

  test("a department member sees their own department's documents", async () => {
    const found = await service(documentsOf("dept-esn-oslo")).search(
      DEPARTMENT_MEMBER(),
      { domain: "documents", limit: 20, offset: 0 }
    );
    expect(found.rows.map((row) => row.id)).toContain("ours");
  });

  test("and not another department's", async () => {
    const found = await service(documentsOf("dept-esn-oslo")).search(
      DEPARTMENT_MEMBER(),
      { domain: "documents", limit: 20, offset: 0 }
    );
    expect(found.rows.map((row) => row.id)).not.toContain("theirs");
  });

  /**
   * The two tests above assert the ROWS. The scope line beside them was built
   * from a second, different field set — the registry's scalar pair — so it
   * went on saying what the rows had stopped being: the query narrowed on
   * `department.$id` and returned this department's documents while the
   * description announced that the collection has no department dimension at
   * all, which is the wording `describeScope` reserves for "you get nothing".
   * A client reading the envelope rather than counting rows would take a
   * correctly scoped result for an unscoped one.
   */
  test("and the scope line says so, instead of denying the dimension", async () => {
    const found = await service(documentsOf("dept-esn-oslo")).search(
      DEPARTMENT_MEMBER(),
      { domain: "documents", limit: 20, offset: 0 }
    );
    expect(found.rows).not.toHaveLength(0);
    expect(found.scope.departmentIds).toContain("dept-esn-oslo");
    expect(found.scope.summary).not.toContain("no department dimension");
  });

  test("the control: a domain that does have the scalar is unchanged", async () => {
    // `news` declares `department_id` as well as the relationship, so the
    // relation-preferring field set must describe it exactly as the scalar one
    // did. This is the over-reach the fix could plausibly have caused.
    const found = await service({
      news: [
        {
          $id: "ours",
          $updatedAt: "2026-01-01T00:00:00.000Z",
          slug: "ours",
          status: "draft",
          campus_id: "1",
          campus: { $id: "1" },
          department_id: "dept-esn-oslo",
          department: { $id: "dept-esn-oslo" },
        },
      ],
      content_translations: [],
    }).search(DEPARTMENT_MEMBER(), { domain: "news", limit: 20, offset: 0 });
    expect(found.rows.map((row) => row.id)).toEqual(["ours"]);
    expect(found.scope.departmentIds).toContain("dept-esn-oslo");
    expect(found.scope.summary).not.toContain("no department dimension");
  });
});
