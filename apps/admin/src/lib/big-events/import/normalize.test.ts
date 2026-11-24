import { describe, expect, test } from "bun:test";
import {
  normalizeEmail,
  normalizeName,
  normalizePhone,
  parseCampus,
  parseRoomCount,
  parseRoomSize,
  splitFullName,
} from "./normalize";

describe("normalizePhone", () => {
  test("handles the common Norwegian formats", () => {
    expect(normalizePhone("912 34 567")).toBe("+4791234567");
    expect(normalizePhone("+47 91234567")).toBe("+4791234567");
    expect(normalizePhone("004791234567")).toBe("+4791234567");
    expect(normalizePhone("4791234567")).toBe("+4791234567");
    expect(normalizePhone("123")).toBeNull();
  });
});

describe("normalizeName", () => {
  test("normalizeName treats casing and spacing as the same", () => {
    expect(normalizeName("ØYVIND  ås ")).toBe(normalizeName("Øyvind Ås"));
  });
  test("keeps æøå", () => {
    expect(normalizeName("ÆØÅ")).toBe("æøå");
  });
});

describe("splitFullName", () => {
  test("last word is the last name", () => {
    expect(splitFullName("Ola Johan Nordmann")).toEqual({
      first: "Ola Johan",
      last: "Nordmann",
    });
  });
  test("single word has no last name", () => {
    expect(splitFullName("  Ola ")).toEqual({ first: "Ola", last: null });
  });
});

describe("parseCampus", () => {
  test("finds the campus in a ticket label", () => {
    expect(parseCampus("1 x Bergen - BISO - 4-Person")).toBe("2");
    expect(parseCampus("oslo")).toBe("1");
    expect(parseCampus("Trondheim")).toBe("3");
    expect(parseCampus("Stavanger")).toBe("4");
  });
  test("returns null when no campus is named", () => {
    expect(parseCampus("BISO")).toBeNull();
    expect(parseCampus("National")).toBeNull();
    expect(parseCampus(null)).toBeNull();
  });
});

describe("parseRoomCount", () => {
  test("reads the leading quantity of a ticket category", () => {
    expect(parseRoomCount("2 x Bergen - BISO - 4-Person")).toBe(2);
    expect(parseRoomCount("1 x Bergen - BISO - 4-Person")).toBe(1);
    expect(parseRoomCount("3x Oslo - Dobbeltrom")).toBe(3);
  });
  test("is one room when there is no quantity", () => {
    expect(parseRoomCount("Bergen - BISO - 4-Person")).toBe(1);
    expect(parseRoomCount("0 x Bergen")).toBe(1);
    expect(parseRoomCount(null)).toBe(1);
  });
});

describe("parseRoomSize", () => {
  test("reads sizes from labels", () => {
    expect(parseRoomSize("1 x Bergen - BISO - 4-Person")).toBe(4);
    expect(parseRoomSize("4 person")).toBe(4);
    expect(parseRoomSize("4-personsrom")).toBe(4);
    expect(parseRoomSize("Enkeltrom")).toBe(1);
    expect(parseRoomSize("Dobbeltrom")).toBe(2);
  });
  test("returns null otherwise", () => {
    expect(parseRoomSize("BISO")).toBeNull();
    expect(parseRoomSize(undefined)).toBeNull();
  });
});

describe("normalizeEmail", () => {
  test("trims and lowercases", () => {
    expect(normalizeEmail("  Ola@BI.no ")).toBe("ola@bi.no");
  });
  test("rejects values without @", () => {
    expect(normalizeEmail("ola")).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
  });
});
