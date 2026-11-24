import { describe, expect, test } from "bun:test";
import {
  BIG_EVENT_SLUG_MAX,
  bigEventSlugCandidates,
  slugifyBigEventName,
} from "./slug";

describe("slugifyBigEventName", () => {
  test("turns Norwegian letters into ASCII and drops punctuation", () => {
    expect(slugifyBigEventName("Fadderullan Bergen 2027 – Ø")).toBe(
      "fadderullan-bergen-2027-o"
    );
    expect(slugifyBigEventName("Ærlig Åpen Høstfest")).toBe(
      "aerlig-apen-hostfest"
    );
  });

  test("strips accents and trims dashes", () => {
    expect(slugifyBigEventName("  Café Søndag!  ")).toBe("cafe-sondag");
  });

  test("keeps at most 120 characters without a trailing dash", () => {
    const slug = slugifyBigEventName(`${"a".repeat(119)} b`);
    expect(slug.length).toBeLessThanOrEqual(BIG_EVENT_SLUG_MAX);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("bigEventSlugCandidates", () => {
  test("starts with the base and then numbers it", () => {
    expect(bigEventSlugCandidates("winter-games-2027", 3)).toEqual([
      "winter-games-2027",
      "winter-games-2027-2",
      "winter-games-2027-3",
    ]);
  });

  test("shortens a long base so the number fits", () => {
    const base = "a".repeat(BIG_EVENT_SLUG_MAX);
    const [, second] = bigEventSlugCandidates(base, 2);
    expect(second).toBe(`${"a".repeat(BIG_EVENT_SLUG_MAX - 2)}-2`);
  });

  test("falls back to a plain word when the name has no letters", () => {
    expect(bigEventSlugCandidates("", 1)).toEqual(["big-event"]);
  });
});
