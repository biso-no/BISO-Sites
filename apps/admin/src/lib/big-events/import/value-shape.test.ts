import { describe, expect, test } from "bun:test";
import { describeValueShape } from "./value-shape";

describe("describeValueShape", () => {
  test("describes emails", () => {
    expect(describeValueShape(["ola@example.com", "kari@bi.no"])).toBe(
      "text@domain"
    );
  });

  test("describes phone numbers", () => {
    expect(describeValueShape(["+4791234567"])).toContain("8 digits");
    expect(describeValueShape(["91234567", "92345678"])).toBe("8 digits");
  });

  test("describes small numbers as a range", () => {
    expect(describeValueShape(["1", "4", "2"])).toBe("number 1–4");
  });

  test("describes names without echoing them", () => {
    const shape = describeValueShape(["Ola Nordmann"]);
    expect(shape).toBe("one to three capitalized words");
    expect(shape).not.toContain("Ola");
    expect(shape).not.toContain("Nordmann");
  });

  test("describes longer and joined names as names", () => {
    expect(describeValueShape(["Ola Nordmann Hansen"])).toBe(
      "one to three capitalized words"
    );
    expect(describeValueShape(["Anne-Lise O'Brien"])).toBe(
      "one to three capitalized words"
    );
  });

  test("describes ticket-like text without echoing it", () => {
    const shape = describeValueShape(["1 x Bergen - BISO - 4-Person"]);
    expect(shape).toBe("text with a city name and a number");
    expect(shape).not.toContain("Bergen");
  });

  test("returns empty for no values", () => {
    expect(describeValueShape([])).toBe("empty");
    expect(describeValueShape(["", "  "])).toBe("empty");
  });
});
