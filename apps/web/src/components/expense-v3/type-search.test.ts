import { describe, expect, it } from "vitest";
import { filterTypeOptions } from "./type-search";
import type { ExpenseTypeOption } from "./types";

const options: ExpenseTypeOption[] = [
  { slug: "travel", label: "Travel", labelNo: "Reise", askOccasion: false },
  {
    slug: "food",
    label: "Food while travelling",
    labelNo: "Mat på reise",
    askOccasion: false,
  },
  { slug: "social", label: "Social event", labelNo: null, askOccasion: true },
  { slug: "cafe", label: "Café", labelNo: "Kafé", askOccasion: false },
];

describe("filterTypeOptions", () => {
  it("matches Norwegian and English names ignoring case and diacritics", () => {
    expect(
      filterTypeOptions("REISE", options, "no").matches.map((o) => o.slug)
    ).toEqual(["travel", "food"]);
    expect(
      filterTypeOptions("trav", options, "en").matches.map((o) => o.slug)
    ).toEqual(["travel", "food"]);
    expect(
      filterTypeOptions("cafe", options, "en").matches.map((o) => o.slug)
    ).toEqual(["cafe"]);
    expect(
      filterTypeOptions("kafe", options, "no").matches.map((o) => o.slug)
    ).toEqual(["cafe"]);
  });

  it("selects the matching type when the typed text equals a name", () => {
    expect(filterTypeOptions("  reise ", options, "en").exact?.slug).toBe(
      "travel"
    );
    expect(filterTypeOptions("Social event", options, "no").exact?.slug).toBe(
      "social"
    );
  });

  it("offers own text only when nothing matches exactly", () => {
    expect(filterTypeOptions("trav", options, "en").offerOwnText).toBe(true);
    expect(filterTypeOptions("zzz", options, "en")).toEqual({
      matches: [],
      exact: null,
      offerOwnText: true,
    });
    expect(filterTypeOptions("Travel", options, "en").offerOwnText).toBe(false);
  });

  it("ignores a blank query", () => {
    const result = filterTypeOptions("   ", options, "en");
    expect(result.matches).toEqual(options);
    expect(result.exact).toBeNull();
    expect(result.offerOwnText).toBe(false);
  });
});
