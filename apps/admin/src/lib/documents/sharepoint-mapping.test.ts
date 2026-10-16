import { afterEach, describe, expect, test } from "bun:test";
import {
  buildDocumentFileNames,
  documentPathKey,
  getDocumentsDriveId,
  isSharePointSharingLink,
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

  test("any category gets a campus subfolder when a campus name is given", () => {
    expect(resolveFolderPath("code-of-conduct", "no", "Oslo")).toBe(
      "/Organisational documents/Code of Conduct/Oslo/Norsk versjon"
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

describe("documentPathKey", () => {
  const national = {
    campus_id: null,
    category: "national-statutes",
    language: "no",
    scope: "national",
    title: "Vedtekter for BISO",
  };
  const oslo = { ...national, campus_id: "campus-oslo", scope: "campus" };

  test("ignores letter case in the title, as SharePoint file names do", () => {
    expect(documentPathKey({ ...national, title: "VEDTEKTER for biso" })).toBe(
      documentPathKey(national)
    );
    expect(documentPathKey({ ...national, title: "LOVER ÆØÅ" })).toBe(
      documentPathKey({ ...national, title: "lover æøå" })
    );
  });

  test("treats composed and decomposed letters as the same name", () => {
    expect(documentPathKey({ ...national, title: "Lover a\u030A" })).toBe(
      documentPathKey({ ...national, title: "Lover \u00E5" })
    );
  });

  test("ignores the campus of a national document", () => {
    expect(documentPathKey({ ...national, campus_id: "campus-oslo" })).toBe(
      documentPathKey(national)
    );
  });

  test("separates campuses, and campus documents from national ones", () => {
    expect(documentPathKey(oslo)).not.toBe(
      documentPathKey({ ...oslo, campus_id: "campus-bergen" })
    );
    expect(documentPathKey(oslo)).not.toBe(documentPathKey(national));
  });

  test("matches titles that sanitise to the same file name", () => {
    expect(
      documentPathKey({ ...national, title: " Vedtekter  for BISO? " })
    ).toBe(documentPathKey(national));
  });

  test("separates categories and languages, defaulting the language to Norwegian", () => {
    expect(
      documentPathKey({ ...national, category: "code-of-conduct" })
    ).not.toBe(documentPathKey(national));
    expect(documentPathKey({ ...national, language: "en" })).not.toBe(
      documentPathKey(national)
    );
    expect(documentPathKey({ ...national, language: null })).toBe(
      documentPathKey(national)
    );
    expect(documentPathKey({ ...national, language: undefined })).toBe(
      documentPathKey(national)
    );
  });

  test("separates genuinely different titles", () => {
    expect(
      documentPathKey({ ...national, title: "Vedtekter for BISO 2" })
    ).not.toBe(documentPathKey(national));
  });
});

describe("isSharePointSharingLink", () => {
  test("recognises an anyone-with-the-link URL", () => {
    expect(
      isSharePointSharingLink(
        "https://biso.sharepoint.com/:b:/g/EaBcDeFgHiJkLmNoPq?e=abc123"
      )
    ).toBe(true);
    expect(
      isSharePointSharingLink(
        "https://biso.sharepoint.com/:b:/s/Intranet/EaBcDeFgHiJk"
      )
    ).toBe(true);
  });

  test("rejects a plain library URL that needs a BISO sign-in", () => {
    expect(
      isSharePointSharingLink(
        "https://biso.sharepoint.com/sites/Intranet/Delte%20dokumenter/Organisational%20documents/Statutes/Norsk%20versjon/file.pdf"
      )
    ).toBe(false);
  });

  test("rejects an empty or unparseable value", () => {
    expect(isSharePointSharingLink("")).toBe(false);
    expect(isSharePointSharingLink("not a url")).toBe(false);
  });
});

test("archive folder name matches the existing SharePoint convention", () => {
  expect(PREVIOUS_VERSIONS_FOLDER).toBe("Previous versions");
});
