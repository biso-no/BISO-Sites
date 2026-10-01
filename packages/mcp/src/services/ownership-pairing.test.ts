/**
 * A campus and a department are authorized as a *pair*, not one at a time.
 *
 * `assertWriteAccess` answers two separate questions — may this principal
 * write at this campus, and is this department one of theirs — and for a
 * campus or global admin the department arm never runs at all, because they
 * manage the campus outright. Nothing in it says the department belongs to the
 * campus. `biso_content_create_draft` is the only write in this package that
 * takes both from the caller, so it is the only one that could be handed a
 * mismatched pair and create a row whose two ownership relationships disagree.
 *
 * `assertContentOwnership` in `apps/admin/src/lib/content-authorization.ts` is
 * the repo's rule and this mirrors its shape: the cheap scope check first, so
 * an out-of-scope request never costs a read, then re-read the department and
 * compare.
 */

import { describe, expect, test } from "bun:test";
import {
  createFakeBackend,
  GLOBAL_ADMIN,
  makePrincipal,
} from "../testing/index";
import { createContentService } from "./content";

/**
 * Two campuses, one department at each. `campus` is the relationship and
 * `campus_id` the legacy scalar; `rowOwnership` prefers the relationship, so
 * the fixtures carry both to prove which one decides.
 */
function tables() {
  return {
    campus: [
      { $id: "1", name: "Oslo" },
      { $id: "2", name: "Bergen" },
    ],
    departments: [
      {
        $id: "dept-oslo",
        Name: "Oslo Marketing",
        campus: { $id: "1" },
        campus_id: "1",
        active: true,
      },
      {
        $id: "dept-bergen",
        Name: "Bergen Marketing",
        campus: { $id: "2" },
        campus_id: "2",
        active: true,
      },
    ],
  };
}

const BELONGS_TO = /belongs to/;
const DO_NOT_MANAGE = /do not manage/;
const NO_DEPARTMENT = /No department/;

const LINKS = {
  web: (path: string) => `https://biso.no${path}`,
  admin: (path: string) => `https://admin.biso.no${path}`,
};

function content() {
  return createContentService(createFakeBackend({ tables: tables() }), LINKS);
}

describe("a global admin", () => {
  test("is refused a department that belongs to another campus", async () => {
    // The case `assertWriteAccess` cannot catch: a global admin clears the
    // campus arm outright, so before this check nothing looked at the pair.
    await expect(
      content().assertWritableOwnership(GLOBAL_ADMIN(), "1", "dept-bergen")
    ).rejects.toThrow(BELONGS_TO);
  });

  test("may still name a department that does belong to it", async () => {
    await expect(
      content().assertWritableOwnership(GLOBAL_ADMIN(), "1", "dept-oslo")
    ).resolves.toBeUndefined();
  });

  test("and a campus with no department at all is unaffected", async () => {
    await expect(
      content().assertWritableOwnership(GLOBAL_ADMIN(), "1", null)
    ).resolves.toBeUndefined();
  });
});

describe("a campus admin", () => {
  function campusAdmin() {
    return makePrincipal({
      userId: "oslo-admin",
      roles: ["campusadmin"],
      campusNames: ["Oslo"],
      resolvedCampusIds: ["1"],
      managedCampusIds: ["1"],
      profile: "staff",
    });
  }

  test("is refused another campus's department under their own campus", async () => {
    await expect(
      content().assertWritableOwnership(campusAdmin(), "1", "dept-bergen")
    ).rejects.toThrow(BELONGS_TO);
  });

  test("is still refused the other campus outright, without a read", async () => {
    // The cheap check runs first: this must fail on scope, not on pairing.
    await expect(
      content().assertWritableOwnership(campusAdmin(), "2", "dept-bergen")
    ).rejects.toThrow(DO_NOT_MANAGE);
  });
});

describe("a department that cannot be read", () => {
  test("is refused as invalid input rather than accepted", async () => {
    await expect(
      content().assertWritableOwnership(GLOBAL_ADMIN(), "1", "dept-missing")
    ).rejects.toThrow(NO_DEPARTMENT);
  });
});
