import { describe, expect, test } from "bun:test";
import { requestedPageCampusId, resolvePageSaveCampusId } from "./page-campus";

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

describe("requestedPageCampusId", () => {
  const base = {
    activeCampusId: undefined,
    managedCampusIds: [] as string[],
    resolvedCampusIds: [] as string[],
    roles: [] as string[],
  };

  test("a global admin may choose any campus, or none for a national page", () => {
    const ctx = { ...base, roles: ["globaladmin"] };
    expect(requestedPageCampusId("2", ctx)).toBe("2");
    expect(requestedPageCampusId("", ctx)).toBeNull();
  });

  test("a campus admin is held to the campuses they manage", () => {
    const ctx = { ...base, managedCampusIds: ["1"], roles: ["campusadmin"] };
    expect(requestedPageCampusId("1", ctx)).toBe("1");
    expect(requestedPageCampusId("2", ctx)).toBe("1");
    expect(requestedPageCampusId("", ctx)).toBe("1");
  });

  test("a department user always gets their own campus, whatever was sent", () => {
    const ctx = { ...base, resolvedCampusIds: ["3"] };
    expect(requestedPageCampusId("1", ctx)).toBe("3");
    expect(requestedPageCampusId(undefined, ctx)).toBe("3");
  });
});

describe("resolvePageSaveCampusId with a chosen campus", () => {
  test("an explicit choice wins over the persisted campus on update", () => {
    expect(
      resolvePageSaveCampusId({
        authorCampusId: "1",
        chosenCampusId: "2",
        isUpdate: true,
        persistedCampusId: "1",
      })
    ).toBe("2");
  });

  test("a unit page keeps its persisted campus whatever was chosen", () => {
    // The unit URL encodes the campus; moving the page would orphan it.
    expect(
      resolvePageSaveCampusId({
        authorCampusId: "1",
        campusLocked: true,
        chosenCampusId: "2",
        isUpdate: true,
        persistedCampusId: "1",
      })
    ).toBe("1");
  });

  test("a document without a campus field falls back as before", () => {
    expect(
      resolvePageSaveCampusId({
        authorCampusId: "1",
        isUpdate: true,
        persistedCampusId: "4",
      })
    ).toBe("4");
  });
});
