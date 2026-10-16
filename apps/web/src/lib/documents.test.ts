import type { Documents, DocumentVersions } from "@repo/api/types/appwrite";
import { describe, expect, it } from "vitest";
import { NATIONAL_CAMPUS_ID } from "./campus-scope";
import {
  attachPreviousVersions,
  isDocumentVisibleForCampus,
  sortDocumentsForDisplay,
} from "./documents";

const national = { campus_id: null, scope: "national" } as Documents;
const oslo = { campus_id: "1", scope: "campus" } as Documents;
const bergen = { campus_id: "2", scope: "campus" } as Documents;
const nationalCampus = {
  campus_id: NATIONAL_CAMPUS_ID,
  scope: "campus",
} as Documents;

describe("isDocumentVisibleForCampus", () => {
  it("shows everything when all campuses are selected", () => {
    for (const selection of [null, undefined, "", "all"]) {
      for (const doc of [national, oslo, bergen, nationalCampus]) {
        expect(isDocumentVisibleForCampus(doc, selection)).toBe(true);
      }
    }
  });

  it("shows the selected campus and national documents only", () => {
    expect(isDocumentVisibleForCampus(oslo, "1")).toBe(true);
    expect(isDocumentVisibleForCampus(national, "1")).toBe(true);
    expect(isDocumentVisibleForCampus(nationalCampus, "1")).toBe(true);
    expect(isDocumentVisibleForCampus(bergen, "1")).toBe(false);
  });

  it("shows only national documents when National is selected", () => {
    expect(isDocumentVisibleForCampus(national, NATIONAL_CAMPUS_ID)).toBe(true);
    expect(isDocumentVisibleForCampus(nationalCampus, NATIONAL_CAMPUS_ID)).toBe(
      true
    );
    expect(isDocumentVisibleForCampus(oslo, NATIONAL_CAMPUS_ID)).toBe(false);
  });

  it("hides a campus-scoped document that has no campus", () => {
    const orphan = { campus_id: null, scope: "campus" } as Documents;
    expect(isDocumentVisibleForCampus(orphan, "1")).toBe(false);
  });
});

describe("sortDocumentsForDisplay", () => {
  it("orders by category, then title, without mutating the input", () => {
    const docs = [
      { category: "campus-bylaws", title: "B" },
      { category: "code-of-conduct", title: "A" },
      { category: "national-statutes", title: "Z" },
      { category: "campus-bylaws", title: "A" },
      { category: "something-new", title: "A" },
    ] as Documents[];

    const sorted = sortDocumentsForDisplay(docs);

    expect(sorted.map((d) => `${d.category}:${d.title}`)).toEqual([
      "national-statutes:Z",
      "campus-bylaws:A",
      "campus-bylaws:B",
      "code-of-conduct:A",
      "something-new:A",
    ]);
    expect(docs[0]?.title).toBe("B");
  });
});

describe("attachPreviousVersions", () => {
  const version = (
    id: string,
    documentId: string,
    major: number,
    minor = 0
  ): DocumentVersions =>
    ({
      $createdAt: "2026-01-01T00:00:00.000Z",
      $id: id,
      document_id: documentId,
      file_size: 10,
      version_major: major,
      version_minor: minor,
    }) as DocumentVersions;

  it("lists older versions newest first and leaves out the current one", () => {
    const docs = [{ $id: "doc-1", version: "12" }] as Documents[];
    const result = attachPreviousVersions(docs, [
      version("a", "doc-1", 7, 1),
      version("b", "doc-1", 12),
      version("c", "doc-1", 7, 10),
      version("d", "doc-2", 99),
    ]);

    expect(result[0]?.previousVersions.map((v) => v.label)).toEqual([
      "7.10",
      "7.1",
    ]);
    expect(result[0]?.previousVersions[0]?.id).toBe("c");
  });

  it("gives documents without history an empty list", () => {
    const docs = [{ $id: "doc-1", version: null }] as Documents[];
    expect(attachPreviousVersions(docs, [])[0]?.previousVersions).toEqual([]);
  });
});
