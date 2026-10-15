import { describe, expect, it } from "vitest";
import {
  APPLICATION_DOCUMENTS,
  applicationDocumentFileId,
  coverLetterTextForScreening,
  isApplicationDocument,
  validateApplicationDocument,
} from "./application-documents";

const pdf = (size = 10) =>
  new File([new Uint8Array(size)], "letter.pdf", { type: "application/pdf" });

describe("application documents", () => {
  it("knows the two documents an application carries", () => {
    expect(APPLICATION_DOCUMENTS).toEqual(["resume", "cover_letter"]);
    expect(isApplicationDocument("cover_letter")).toBe(true);
    expect(isApplicationDocument("notes")).toBe(false);
  });

  it("reads each document's file id from its own column", () => {
    const row = { cover_letter_file_id: "cl-1", resume_file_id: "cv-1" };
    expect(applicationDocumentFileId(row, "resume")).toBe("cv-1");
    expect(applicationDocumentFileId(row, "cover_letter")).toBe("cl-1");
    expect(applicationDocumentFileId({}, "cover_letter")).toBeNull();
  });

  it("accepts a PDF up to 5 MB and nothing else", () => {
    expect(() => validateApplicationDocument(pdf())).not.toThrow();
    expect(() =>
      validateApplicationDocument(
        new File(["x"], "letter.docx", {
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        })
      )
    ).toThrow("must be a PDF");
    expect(() => validateApplicationDocument(pdf(5 * 1024 * 1024 + 1))).toThrow(
      "too large"
    );
  });

  it("keeps extracted cover letter text within what the screener reads", () => {
    const long = "a".repeat(20_000);
    expect(coverLetterTextForScreening(long)?.length).toBe(12_000);
    expect(coverLetterTextForScreening("  short  ")).toBe("short");
    expect(coverLetterTextForScreening(null)).toBeNull();
    expect(coverLetterTextForScreening("   ")).toBeNull();
  });
});
