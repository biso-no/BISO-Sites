import { describe, expect, test } from "bun:test";
import { resolvePageSaveCampusId } from "./page-campus";

describe("resolvePageSaveCampusId", () => {
  test("update: uses the persisted campus, not the author's", () => {
    expect(
      resolvePageSaveCampusId({
        authorCampusId: null,
        isUpdate: true,
        persistedCampusId: "campus-oslo",
      })
    ).toBe("campus-oslo");
  });

  test("update: a global admin with no active campus filter does not blank an existing page's campus", () => {
    expect(
      resolvePageSaveCampusId({
        authorCampusId: null,
        isUpdate: true,
        persistedCampusId: "campus-oslo",
      })
    ).toBe("campus-oslo");
  });

  test("update: falls back to the author's campus when nothing is persisted yet (pre-backfill row)", () => {
    expect(
      resolvePageSaveCampusId({
        authorCampusId: "campus-bergen",
        isUpdate: true,
        persistedCampusId: null,
      })
    ).toBe("campus-bergen");
  });

  test("create: always uses the author-derived campus, ignoring any persisted value", () => {
    expect(
      resolvePageSaveCampusId({
        authorCampusId: "campus-bergen",
        isUpdate: false,
        persistedCampusId: "campus-oslo",
      })
    ).toBe("campus-bergen");
  });

  test("create: a global admin with no campus filter yields null", () => {
    expect(
      resolvePageSaveCampusId({
        authorCampusId: null,
        isUpdate: false,
        persistedCampusId: null,
      })
    ).toBeNull();
  });
});
