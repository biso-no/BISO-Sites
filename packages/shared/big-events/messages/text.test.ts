import { describe, expect, it } from "vitest";
import {
  defaultAutoTexts,
  findPlaceholders,
  PLACEHOLDER_LABELS,
  PLACEHOLDERS,
  placeholderToken,
  renderText,
} from "./text";

describe("message text", () => {
  it("reads placeholders in either language", () => {
    const found = findPlaceholders(
      "Hei {fornavn} / {First Name}, {buss} {departure} {  meeting   point } {oppmøtested} {BUSSKONTAKT} {rom}"
    );
    expect(found.unknown).toEqual([]);
    expect(found.known).toEqual([
      "first_name",
      "first_name",
      "bus",
      "departure",
      "meeting_point",
      "meeting_point",
      "bus_contact",
      "room",
    ]);
    expect(placeholderToken("no", "first_name")).toBe("{fornavn}");
    expect(placeholderToken("en", "meeting_point")).toBe("{meeting point}");
    expect(PLACEHOLDER_LABELS.no.first_name).toBe("fornavn");
    expect(Object.keys(PLACEHOLDER_LABELS.en)).toEqual([...PLACEHOLDERS]);
  });

  it("flags unknown braces", () => {
    const found = findPlaceholders('Hi {name} {bus} { {"a": 1} } and {');
    expect(found.known).toEqual(["bus"]);
    expect(found.unknown).toEqual(["name"]);
  });

  it("empty values leave no braces", () => {
    const out = renderText("Hei {fornavn}! Buss {buss} fra {oppmøtested} .", {
      first_name: "Ola",
      bus: "Buss 3",
      meeting_point: "",
    });
    expect(out).toBe("Hei Ola! Buss Buss 3 fra.");
    expect(out).not.toContain("{");
    expect(out).not.toContain("  ");
    expect(out).not.toContain(" .");
    expect(renderText("Hei {fornavn}!", {})).toBe("Hei!");
  });

  it("leaves unknown braces and untouched text alone", () => {
    expect(renderText('A  {x} {"a": 1}  b', { bus: "1" })).toBe(
      'A  {x} {"a": 1}  b'
    );
  });

  it("push text drops the first name", () => {
    const text = "Hei {first name}! You're on {bus}.";
    const vars = { first_name: "Ola", bus: "Bus 3" };
    expect(renderText(text, vars)).toBe("Hei Ola! You're on Bus 3.");
    expect(renderText(text, vars, { forPush: true })).toBe(
      "Hei! You're on Bus 3."
    );
  });

  it("defaults exist for every automatic kind in both languages", () => {
    for (const kind of [
      "bus_assigned",
      "bus_moved",
      "bus_none",
      "departure_reminder",
    ] as const) {
      const texts = defaultAutoTexts(kind);
      for (const locale of ["no", "en"] as const) {
        expect(texts[locale].title.length).toBeGreaterThan(0);
        expect(texts[locale].body.length).toBeGreaterThan(0);
        expect(findPlaceholders(texts[locale].body).unknown).toEqual([]);
      }
    }
    expect(defaultAutoTexts("bus_assigned").no.body).toBe(
      "Hei {fornavn}! Du skal med {buss}. Den går {avgang} fra {oppmøtested}."
    );
  });
});
