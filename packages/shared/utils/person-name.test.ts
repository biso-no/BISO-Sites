import { describe, expect, it } from "vitest";
import { normalizeBiDisplayName } from "./person-name";

describe("normalizeBiDisplayName", () => {
  it("turns BI's directory names into first name, last name", () => {
    expect(normalizeBiDisplayName("(Student) Heien, Markus")).toBe(
      "Markus Heien"
    );
    expect(normalizeBiDisplayName("Heien, Markus")).toBe("Markus Heien");
    expect(normalizeBiDisplayName("Heien, markus (External)")).toBe(
      "Markus Heien"
    );
  });

  it("tolerates stray whitespace", () => {
    expect(normalizeBiDisplayName("  (Student)  Heien ,  Markus  ")).toBe(
      "Markus Heien"
    );
  });

  it("keeps middle names, double-barrelled surnames and particles as written", () => {
    expect(normalizeBiDisplayName("Nordmann-Hansen, Ola Kristian")).toBe(
      "Ola Kristian Nordmann-Hansen"
    );
    expect(normalizeBiDisplayName("van der Berg, Anna")).toBe(
      "Anna van der Berg"
    );
  });

  it("capitalizes only a part BI wrote entirely in lowercase", () => {
    expect(normalizeBiDisplayName("heien, anne-marie (External)")).toBe(
      "Anne-Marie Heien"
    );
    expect(normalizeBiDisplayName("ødegård, åse (External)")).toBe(
      "Åse Ødegård"
    );
    expect(normalizeBiDisplayName("Ødegård, Åse")).toBe("Åse Ødegård");
  });

  it("leaves names that are not in BI's format alone", () => {
    for (const name of [
      "Markus Heien",
      "Ola Nordmann (BISO)",
      "(Student) Markus",
      "Heien,",
      ", Markus",
      "Heien, Markus, Jr",
      "",
    ]) {
      expect(normalizeBiDisplayName(name)).toBe(name);
    }
  });
});
