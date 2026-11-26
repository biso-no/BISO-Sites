import { describe, expect, test } from "bun:test";
import { autoTextsColumn, autoTextsSchema } from "./auto-texts";

describe("autoTextsColumn", () => {
  test("stores the texts as R18 JSON, trimmed, without empty ones", () => {
    const result = autoTextsColumn({
      bus_assigned: {
        en: { body: "  ", title: "" },
        no: { body: " Hei {fornavn}! Du skal med {buss}. ", title: "Bussen" },
      },
      bus_moved: { en: { body: "", title: "" } },
    });
    if (!(result.ok && result.value)) {
      throw new Error("expected stored texts");
    }
    expect(JSON.parse(result.value)).toEqual({
      bus_assigned: {
        no: { body: "Hei {fornavn}! Du skal med {buss}.", title: "Bussen" },
      },
    });
  });

  test("nothing written means the defaults (null)", () => {
    expect(autoTextsColumn(null)).toEqual({ ok: true, value: null });
    expect(autoTextsColumn({ bus_none: { no: { title: " " } } })).toEqual({
      ok: true,
      value: null,
    });
  });

  test("an unknown placeholder is refused", () => {
    expect(
      autoTextsColumn({
        departure_reminder: { en: { body: "{bus} leaves at {time}" } },
      })
    ).toEqual({ error: "unknown_placeholder", ok: false });
  });

  test("a title over 200, a text over 2000 or all over 4000 is refused", () => {
    const tooLong = [
      { bus_assigned: { no: { title: "x".repeat(201) } } },
      { bus_assigned: { en: { body: "x".repeat(2001) } } },
      {
        bus_assigned: { en: { body: "x".repeat(1100) } },
        bus_moved: { en: { body: "x".repeat(1100) } },
        bus_none: { en: { body: "x".repeat(1100) } },
        departure_reminder: { en: { body: "x".repeat(1100) } },
      },
    ];
    for (const texts of tooLong) {
      expect(autoTextsColumn(texts)).toEqual({ error: "too_long", ok: false });
    }
  });
});

describe("autoTextsSchema", () => {
  test("keeps only known kinds and languages", () => {
    expect(
      autoTextsSchema.parse({
        bus_moved: { de: { title: "Bus" }, no: { title: "Ny buss" } },
        manual: { no: { title: "x" } },
      })
    ).toEqual({ bus_moved: { no: { title: "Ny buss" } } });
  });

  test("refuses a text that isn't text", () => {
    expect(() =>
      autoTextsSchema.parse({ bus_moved: { no: { title: 3 } } })
    ).toThrow();
  });
});
