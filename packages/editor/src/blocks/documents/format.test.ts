import { describe, expect, test } from "bun:test";
import {
  accessibleName,
  downloadHref,
  fileTypeLabel,
  formatFileSize,
  metaLine,
  titleFromFilename,
} from "./format";

const VIEW =
  "https://appwrite.biso.no/v1/storage/buckets/media/files/f1/view?project=biso";

describe("formatFileSize", () => {
  test("uses Norwegian decimals", () => {
    expect(formatFileSize(1_200_000)).toBe("1,2 MB");
    expect(formatFileSize(25_000_000)).toBe("25 MB");
  });

  test("covers kB and B", () => {
    expect(formatFileSize(340_000)).toBe("340 kB");
    expect(formatFileSize(1500)).toBe("1,5 kB");
    expect(formatFileSize(512)).toBe("512 B");
  });

  test("has no text for an unknown or unusable size", () => {
    for (const size of [undefined, null, "oops", Number.NaN, -1, 0]) {
      expect(formatFileSize(size)).toBeNull();
    }
  });
});

describe("fileTypeLabel", () => {
  test("names the type from the mime", () => {
    const cases: [string, string][] = [
      ["application/pdf", "PDF"],
      ["application/msword", "Word"],
      [
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Word",
      ],
      ["application/vnd.ms-excel", "Excel"],
      [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Excel",
      ],
      ["application/vnd.ms-powerpoint", "PowerPoint"],
      [
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "PowerPoint",
      ],
      ["text/csv", "CSV"],
      ["text/plain", "TXT"],
    ];
    for (const [mime, label] of cases) {
      expect(fileTypeLabel({ mime, src: "", title: "" }, "no")).toBe(label);
    }
  });

  test("falls back to the extension of the link or the title", () => {
    expect(
      fileTypeLabel({ src: "/files/vedtekter.pdf", title: "x" }, "no")
    ).toBe("PDF");
    expect(fileTypeLabel({ src: VIEW, title: "Budsjett.xlsx" }, "no")).toBe(
      "Excel"
    );
  });

  test("an unknown type is a plain file, in the page language", () => {
    expect(fileTypeLabel({ src: VIEW, title: "Vedtekter" }, "no")).toBe("Fil");
    expect(fileTypeLabel({ src: VIEW, title: "Rules" }, "en")).toBe("File");
  });
});

describe("metaLine", () => {
  test("joins type and size", () => {
    expect(
      metaLine(
        { mime: "application/pdf", size: 1_200_000, src: VIEW, title: "x" },
        "no"
      )
    ).toBe("PDF · 1,2 MB");
  });

  test("shows the type alone when the size is unknown", () => {
    expect(
      metaLine({ mime: "application/pdf", src: VIEW, title: "x" }, "no")
    ).toBe("PDF");
  });
});

describe("downloadHref", () => {
  test("an uploaded file links to its download endpoint", () => {
    expect(downloadHref({ fileId: "f1", src: VIEW, title: "x" })).toBe(
      "https://appwrite.biso.no/v1/storage/buckets/media/files/f1/download?project=biso"
    );
  });

  test("a file id with no link still resolves to the media bucket", () => {
    expect(downloadHref({ fileId: "abc", src: "", title: "x" })).toContain(
      "/storage/buckets/media/files/abc/download"
    );
  });

  test("any other link goes through safeHref", () => {
    expect(downloadHref({ src: "https://example.com/a.pdf", title: "x" })).toBe(
      "https://example.com/a.pdf"
    );
    expect(downloadHref({ src: "javascript:alert(1)", title: "x" })).toBeNull();
    expect(downloadHref({ src: "", title: "x" })).toBeNull();
  });
});

describe("accessibleName", () => {
  test("holds the action, title, type and size", () => {
    const item = {
      mime: "application/pdf",
      size: 1_200_000,
      src: VIEW,
      title: "Vedtekter",
    };
    expect(accessibleName(item, "no")).toBe("Last ned Vedtekter (PDF, 1,2 MB)");
    expect(accessibleName(item, "en")).toBe("Download Vedtekter (PDF, 1.2 MB)");
  });
});

describe("titleFromFilename", () => {
  test("drops the extension and the separators", () => {
    expect(titleFromFilename("Årsberetning_2025.pdf")).toBe(
      "Årsberetning 2025"
    );
    expect(titleFromFilename("noext")).toBe("noext");
  });
});
