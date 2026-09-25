import { expect, test } from "vitest";
import { generateSlug, nextAutoSlug, uniqueSlug } from "./content-slug";

/**
 * Replays what a title input does: one `nextAutoSlug` call per keystroke, each
 * seeing the slug the previous keystroke left behind. This is the shape that
 * regressed in the shop and events studio editors — a per-keystroke guard on the slug being
 * empty stopped after the first character.
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

test("generateSlug trims hyphens from both ends", () => {
  expect(generateSlug("— Kickoff —")).toBe("kickoff");
});

test("Norwegian characters fold to their base letter, not deleted", () => {
  expect(generateSlug("Høstball 2026")).toBe("hostball-2026");
  expect(generateSlug("Årsmøte")).toBe("arsmote");
  expect(generateSlug("Bærekraft")).toBe("barekraft");
  expect(generateSlug("Sosialt samhØld ÆØÅ")).toBe("sosialt-samhold-aoa");
});

test("other accented Latin letters fold to ASCII", () => {
  expect(generateSlug("Café Crème")).toBe("cafe-creme");
  expect(generateSlug("Über Zürich")).toBe("uber-zurich");
  expect(generateSlug("Piñata")).toBe("pinata");
});

test("characters with no ASCII equivalent are dropped, not left in the slug", () => {
  expect(generateSlug("Hoodie 🎉 2026")).toBe("hoodie-2026");
  expect(generateSlug("東京 Night")).toBe("night");
});

test("a title with nothing slug-worthy yields an empty slug", () => {
  expect(generateSlug("🎉🎉")).toBe("");
  expect(generateSlug("   ")).toBe("");
});

test("typing a Norwegian title keystroke by keystroke stays stable", () => {
  expect(typeTitle("Årsmøte 2026")).toBe("arsmote-2026");
});

test("uniqueSlug keeps a free slug", () => {
  expect(uniqueSlug("debate-manager", new Set(), 2026)).toBe("debate-manager");
});

test("uniqueSlug appends the year on a collision", () => {
  expect(uniqueSlug("debate-manager", new Set(["debate-manager"]), 2026)).toBe(
    "debate-manager-2026"
  );
});

test("uniqueSlug counts up once the year variant is taken too", () => {
  const taken = new Set([
    "debate-manager",
    "debate-manager-2026",
    "debate-manager-2026-2",
  ]);
  expect(uniqueSlug("debate-manager", taken, 2026)).toBe(
    "debate-manager-2026-3"
  );
});
