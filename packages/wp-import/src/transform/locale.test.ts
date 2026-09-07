import { describe, expect, test } from "bun:test";
import { detectLocale, otherLocale } from "./locale";

const NORWEGIAN =
  "Karrieredagene rekrutterer til en ny PR and Communications manager for 2026. " +
  "Karrieredagene ønsker å være Norges ledende bindeledd mellom studenter og bedrifter. " +
  "Som Communications Manager vil ditt hovedansvar være å formidle informasjon til studentene.";

const ENGLISH =
  "The Business Relations Committee is looking for a new Marketing Manager. " +
  "You will be responsible for the committee's external communication and visibility, " +
  "and you will play an important role in how we are perceived by students and partners.";

describe("detectLocale", () => {
  test("detects Norwegian from stopwords and æøå", () => {
    expect(detectLocale(NORWEGIAN).locale).toBe("no");
  });

  test("detects English", () => {
    expect(detectLocale(ENGLISH).locale).toBe("en");
  });

  test("is confident about a clearly Norwegian body", () => {
    expect(detectLocale(NORWEGIAN).confidence).toBeGreaterThan(0.6);
  });

  test("reports low confidence for text too short to judge", () => {
    expect(detectLocale("Manager").confidence).toBeLessThan(0.6);
  });

  test("does not treat an English title on a Norwegian body as English", () => {
    const mixed = `PR and Communications Manager Karrieredagene 2026! ${NORWEGIAN}`;

    expect(detectLocale(mixed).locale).toBe("no");
  });

  test("handles empty input without throwing", () => {
    expect(detectLocale("").confidence).toBe(0);
  });
});

describe("otherLocale", () => {
  test("maps no to en and back", () => {
    expect(otherLocale("no")).toBe("en");
    expect(otherLocale("en")).toBe("no");
  });
});
