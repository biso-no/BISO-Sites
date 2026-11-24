import { describe, expect, it } from "vitest";
import { bodyOf, summaryOf, type TranslationText, textFor } from "./common";

const tr = (over: Partial<TranslationText>): TranslationText => ({
  locale: "no",
  title: "T",
  description: null,
  short_description: null,
  ...over,
});

describe("entry common", () => {
  it("falls back to the other locale", () => {
    expect(
      textFor([{ locale: "en", title: "A" } as TranslationText], "no")?.title
    ).toBe("A");
  });
  it("prefers the requested locale", () => {
    expect(
      textFor(
        [tr({ locale: "en", title: "A" }), tr({ locale: "no", title: "B" })],
        "no"
      )?.title
    ).toBe("B");
  });
  it("returns null without translations", () => {
    expect(textFor([], "no")).toBeNull();
  });
  it("summary prefers short_description as plain text", () => {
    expect(
      summaryOf(
        tr({ short_description: "<p>Hei &amp; hå</p>", description: "x" })
      )
    ).toBe("Hei & hå");
  });
  it("summary falls back to a truncated description", () => {
    const s = summaryOf(tr({ description: `<p>${"ord ".repeat(100)}</p>` }));
    expect(s.length).toBeLessThanOrEqual(201);
    expect(s.endsWith("…")).toBe(true);
  });
  it("body is plain text cut to 4000", () => {
    expect(
      bodyOf(tr({ description: `<p>${"a ".repeat(5000)}</p>` })).length
    ).toBeLessThanOrEqual(4001);
    expect(bodyOf(tr({ description: null }))).toBe("");
  });
});
