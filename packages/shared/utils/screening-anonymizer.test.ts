import { describe, expect, it } from "vitest";
import { anonymizeScreeningText } from "./screening-anonymizer";

describe("anonymizeScreeningText", () => {
  it("returns null for missing text", () => {
    expect(anonymizeScreeningText(null)).toBeNull();
    expect(anonymizeScreeningText(undefined)).toBeNull();
  });

  it("replaces every token of the candidate's name, in any common casing", () => {
    const text =
      "KARI NORDMANN\nMy name is Kari Nordmann. Nordmann has worked at DNB.";
    expect(
      anonymizeScreeningText(text, { candidateName: "Kari Nordmann" })
    ).toBe(
      "[Candidate]\nMy name is [Candidate]. [Candidate] has worked at DNB."
    );
  });

  it("only redacts name tokens as whole words", () => {
    expect(
      anonymizeScreeningText("Ola wrote about Olaf and Solan.", {
        candidateName: "Ola",
      })
    ).toBe("[Candidate] wrote about Olaf and Solan.");
  });

  it("handles hyphenated and Norwegian-character names", () => {
    expect(
      anonymizeScreeningText("Anne-Marie Ødegård, Anne", {
        candidateName: "Anne-Marie Ødegård",
      })
    ).toBe("[Candidate], Anne");
  });

  it("strips contact details", () => {
    const text =
      "✉ kari@example.no 🔗 github.com/kari 🌐 https://kari.dev/cv tlf 912 34 567 or +47 22 33 44 55 or 98765432";
    const result = anonymizeScreeningText(text);
    expect(result).toBe(
      "✉ [email] 🔗 [link] 🌐 [link] tlf [phone] or [phone] or [phone]"
    );
  });

  it("strips national ID numbers", () => {
    expect(anonymizeScreeningText("Fnr: 010199 12345")).toBe(
      "Fnr: [national-id]"
    );
  });

  it("strips birth dates and ages", () => {
    expect(anonymizeScreeningText("Født: 01.01.2003\nAge: 22")).toBe(
      "[date of birth]\n[age]"
    );
    expect(anonymizeScreeningText("I am 21 years old")).toBe("I am [age]");
  });

  it("strips street addresses and trailing postcodes", () => {
    expect(
      anonymizeScreeningText("Bor i Nydalsveien 37, 0484 Oslo i dag")
    ).toBe("Bor i [address] i dag");
    expect(anonymizeScreeningText("Adresse: Storgata 1\nNext")).toBe(
      "[address]\nNext"
    );
  });

  it("keeps the content the screening actually needs", () => {
    const text =
      "Bachelor in Finance at BI, 2022–2025. Analyst intern at DNB Markets 2024 2025. Grade average B. Excel, e.g. financial modelling.";
    expect(anonymizeScreeningText(text)).toBe(text);
  });

  it("redacts extra identifiers verbatim", () => {
    expect(
      anonymizeScreeningText("Find me as kari_n99 online", {
        extraIdentifiers: ["kari_n99", null],
      })
    ).toBe("Find me as [redacted] online");
  });

  it("redacts personal handles found in the candidate's own contact details", () => {
    const text =
      "Heiendev  Full Stack Developer ✉ hello@heiendev.com 🔗 github.com/kodekari\nI publish as Kodekari and HEIENDEV.";
    expect(
      anonymizeScreeningText(text, { candidateName: "Markus Heien" })
    ).toBe(
      "[handle]  Full Stack Developer ✉ [email] 🔗 [link]\nI publish as [handle] and [handle]."
    );
  });

  it("keeps company domains and tech names readable", () => {
    const text =
      "Intern at Equinor (equinor.com). Stack: Node.js/React, Next.js. Mail kari@dnb.no";
    expect(
      anonymizeScreeningText(text, { candidateName: "Kari Nordmann" })
    ).toBe(
      "Intern at Equinor ([link]). Stack: Node.js/React, Next.js. Mail [email]"
    );
  });
});
