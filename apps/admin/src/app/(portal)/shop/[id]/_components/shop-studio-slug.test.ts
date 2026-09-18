import { expect, test } from "bun:test";
import { generateSlug, nextAutoSlug } from "./shop-studio-slug";

/**
 * Replays what the title input does: one `nextAutoSlug` call per keystroke,
 * each seeing the slug the previous keystroke left behind. This is the shape
 * that regressed — a per-keystroke guard on `slug` being empty stopped after
 * the first character.
 */
function typeTitle(title: string): string {
  let slug = "";
  for (let i = 1; i <= title.length; i++) {
    const next = nextAutoSlug({ locked: false, title: title.slice(0, i) });
    if (next !== null) {
      slug = next;
    }
  }
  return slug;
}

test("slug follows the whole title, not just the first character", () => {
  expect(typeTitle("Testprodukt")).toBe("testprodukt");
});

test("slug tracks a multi-word title typed character by character", () => {
  expect(typeTitle("BISO Hoodie 2026")).toBe("biso-hoodie-2026");
});

test("a locked slug is never rewritten by a title edit", () => {
  expect(nextAutoSlug({ locked: true, title: "Testprodukt" })).toBeNull();
});

test("generateSlug lowercases, strips punctuation and collapses spaces", () => {
  expect(generateSlug("  BISO's  Winter   Ball! ")).toBe("bisos-winter-ball");
});

test("generateSlug collapses runs of hyphens", () => {
  expect(generateSlug("Hoodie -- black")).toBe("hoodie-black");
});
