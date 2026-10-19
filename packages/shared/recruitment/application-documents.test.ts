import { describe, expect, it } from "vitest";
import {
  APPLICATION_DOCUMENTS,
  applicationDocumentFileId,
  coverLetterTextForScreening,
  isApplicationDocument,
  pdfStorageName,
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

  it("stores every document under a name ending in .pdf", () => {
    // The `resumes` bucket only takes the `pdf` extension by name, while the
    // upload is validated by MIME type, so a PDF called "CV" must be renamed.
    expect(pdfStorageName("cv.pdf", "cv")).toBe("cv.pdf");
    expect(pdfStorageName("CV", "cv")).toBe("CV.pdf");
    expect(pdfStorageName("Søknad.PDF", "cv")).toBe("Søknad.pdf");
    expect(pdfStorageName("letter.docx", "cover-letter")).toBe(
      "letter.docx.pdf"
    );
    expect(pdfStorageName("  CV  ", "cv")).toBe("CV.pdf");
    expect(pdfStorageName("   ", "cover-letter")).toBe("cover-letter.pdf");
    expect(pdfStorageName(".pdf", "cv")).toBe("cv.pdf");
  });

  it("keeps extracted cover letter text within what the screener reads", () => {
    const long = "a".repeat(20_000);
    expect(coverLetterTextForScreening(long)?.length).toBe(12_000);
    expect(coverLetterTextForScreening("  short  ")).toBe("short");
    expect(coverLetterTextForScreening(null)).toBeNull();
    expect(coverLetterTextForScreening("   ")).toBeNull();
  });
});
