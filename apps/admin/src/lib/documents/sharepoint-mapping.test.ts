import { afterEach, describe, expect, test } from "bun:test";
import {
  buildDocumentFileNames,
  getDocumentsDriveId,
  PREVIOUS_VERSIONS_FOLDER,
  resolveFolderPath,
} from "./sharepoint-mapping";

const ORIGINAL_DRIVE_ID = process.env.SHAREPOINT_DOCUMENTS_DRIVE_ID;

afterEach(() => {
  if (ORIGINAL_DRIVE_ID === undefined) {
    Reflect.deleteProperty(process.env, "SHAREPOINT_DOCUMENTS_DRIVE_ID");
  } else {
    process.env.SHAREPOINT_DOCUMENTS_DRIVE_ID = ORIGINAL_DRIVE_ID;
  }
});

describe("getDocumentsDriveId", () => {
  test("returns the trimmed configured drive id", () => {
    process.env.SHAREPOINT_DOCUMENTS_DRIVE_ID = "  b!drive  ";
    expect(getDocumentsDriveId()).toBe("b!drive");
  });

  test("throws instead of guessing a site when unset", () => {
    Reflect.deleteProperty(process.env, "SHAREPOINT_DOCUMENTS_DRIVE_ID");
    expect(() => getDocumentsDriveId()).toThrow(
      "SHAREPOINT_DOCUMENTS_DRIVE_ID is not set"
    );
  });
});

describe("resolveFolderPath", () => {
  test("national categories sit directly under the library root folder", () => {
    expect(resolveFolderPath("national-statutes", "no", null)).toBe(
      "/Organisational documents/Statutes/Norsk versjon"
    );
    expect(resolveFolderPath("code-of-conduct", "en", null)).toBe(
      "/Organisational documents/Code of Conduct/Engelsk versjon"
    );
  });

  test("campus bylaws get a campus subfolder", () => {
    expect(resolveFolderPath("campus-bylaws", "no", "Bergen")).toBe(
      "/Organisational documents/Local laws/Bergen/Norsk versjon"
    );
  });

  test("covers every category the admin form offers", () => {
    expect(resolveFolderPath("authorization-matrix", "no", null)).toBe(
      "/Organisational documents/Authorization Matrix/Norsk versjon"
    );
    expect(resolveFolderPath("target-documents", "en", null)).toBe(
      "/Organisational documents/Target Documents/Engelsk versjon"
    );
  });

  test("throws on an unknown category instead of writing to 'undefined'", () => {
    expect(() => resolveFolderPath("nope", "no", null)).toThrow(
      'No SharePoint folder is mapped for category "nope"'
    );
  });
});

describe("buildDocumentFileNames", () => {
  test("names the current file by title and the archive by title + version", () => {
    expect(buildDocumentFileNames("Lokale lover BISO Bergen", "12")).toEqual({
      archived: "Lokale lover BISO Bergen v12.pdf",
      current: "Lokale lover BISO Bergen.pdf",
    });
  });

  test("keeps Norwegian letters", () => {
    expect(
      buildDocumentFileNames("Vedtekter for BISO – æøå", "7.1").current
    ).toBe("Vedtekter for BISO – æøå.pdf");
  });

  test("strips characters SharePoint or the Graph path rejects", () => {
    expect(
      buildDocumentFileNames('Laws: "Oslo" 50% #1 / draft?*<>|\\', "1").current
    ).toBe("Laws Oslo 50 1 draft.pdf");
  });

  test("drops trailing dots and collapses whitespace", () => {
    expect(
      buildDocumentFileNames("  Code   of  Conduct... ", "3").archived
    ).toBe("Code of Conduct v3.pdf");
  });

  test("falls back to a generic name when nothing usable is left", () => {
    expect(buildDocumentFileNames("???", "1").current).toBe("Document.pdf");
  });

  test("caps very long titles", () => {
    const { current } = buildDocumentFileNames("a".repeat(300), "1");
    expect(current.length).toBeLessThanOrEqual(124);
  });
});

test("archive folder name matches the existing SharePoint convention", () => {
  expect(PREVIOUS_VERSIONS_FOLDER).toBe("Previous versions");
});
