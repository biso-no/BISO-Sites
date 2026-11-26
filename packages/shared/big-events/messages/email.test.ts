import { describe, expect, it } from "vitest";
import { buildMessageEmail } from "./email";

const base = {
  bodyEn: "Line one\nstill one\n\nSecond {first name}",
  bodyNo: "Linje en\n\nAndre {fornavn}",
  eventNameEn: "Winter Games EN",
  eventNameNo: "Vinterlekene",
  locale: null,
  names: null,
  titleEn: "Hello",
  titleNo: "Hei",
  vars: { en: { first_name: "Kari" }, no: { first_name: "Kari" } },
} as const;

describe("buildMessageEmail", () => {
  it("splits paragraphs on blank lines and keeps single line breaks", () => {
    const { html } = buildMessageEmail(base);
    expect(html).toContain("Line one<br>still one</p>");
    expect(html).toContain("Second Kari</p>");
  });

  it("gives the title as one language's subject for a linked person", () => {
    expect(buildMessageEmail({ ...base, locale: "en" }).subject).toBe("Hello");
  });

  it("names the people at the top of each language", () => {
    const { text } = buildMessageEmail({ ...base, names: ["A B", "C D"] });
    expect(text).toContain("Til: A B, C D");
    expect(text).toContain("For: A B, C D");
  });

  it("falls back to the Norwegian event name in the English footer", () => {
    const { text } = buildMessageEmail({
      ...base,
      eventNameEn: null,
      locale: "en",
    });
    expect(text).toContain("on Vinterlekene in BISO.");
  });
});
