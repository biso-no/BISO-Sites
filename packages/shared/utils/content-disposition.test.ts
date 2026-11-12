import { describe, expect, it } from "vitest";
import { contentDisposition } from "./content-disposition";

const PRINTABLE_ASCII = /^[\x20-\x7E]*$/;
const LINE_BREAK = /[\r\n]/;

describe("contentDisposition", () => {
  it("keeps a plain ASCII name as is", () => {
    expect(contentDisposition("inline", "cover-letter.pdf")).toBe(
      "inline; filename=\"cover-letter.pdf\"; filename*=UTF-8''cover-letter.pdf"
    );
  });

  it("carries Norwegian letters in filename* and an ASCII fallback in filename", () => {
    expect(contentDisposition("attachment", "Søknad.pdf")).toBe(
      "attachment; filename=\"S_knad.pdf\"; filename*=UTF-8''S%C3%B8knad.pdf"
    );
  });

  it("encodes characters past U+00FF, such as an en dash", () => {
    const value = contentDisposition("inline", "CV – Kari.pdf");
    expect(value).toContain("filename*=UTF-8''CV%20%E2%80%93%20Kari.pdf");
    expect(value).toContain('filename="CV _ Kari.pdf"');
  });

  it("never lets a quote, backslash or line break break out of the header", () => {
    const value = contentDisposition("inline", 'a"b\\c\r\nd.pdf');
    expect(value).toContain('filename="a_b_c__d.pdf"');
    expect(value).not.toMatch(LINE_BREAK);
  });

  it("percent-encodes the characters RFC 5987 leaves out of attr-char", () => {
    expect(contentDisposition("inline", "CV (1)'s*.pdf")).toContain(
      "filename*=UTF-8''CV%20%281%29%27s%2A.pdf"
    );
  });

  it("falls back to a default name when nothing is left", () => {
    expect(contentDisposition("inline", "  ")).toBe(
      "inline; filename=\"download\"; filename*=UTF-8''download"
    );
  });

  it("always produces a value the Headers API accepts", () => {
    for (const name of [
      "Søknad.pdf",
      "CV – Kari.pdf",
      "履歴書.pdf",
      "Thư.pdf",
    ]) {
      const value = contentDisposition("attachment", name);
      expect(value).toMatch(PRINTABLE_ASCII);
      expect(() => new Headers({ "Content-Disposition": value })).not.toThrow();
    }
  });
});
