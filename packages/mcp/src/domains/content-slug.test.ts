/**
 * The slug contract between this package and the rest of the repo.
 *
 * `biso_content_create_draft` does not derive a slug — it requires one and
 * validates its shape — so this package carries no copy of the derivation
 * logic that PR #76's successor consolidated into
 * `@repo/shared/utils/content-slug` after five surfaces had drifted apart.
 *
 * It does carry an obligation, though. The tool's description tells a caller to
 * follow that canonical rule, which only helps if every slug the rule produces
 * is one this schema accepts. A caller told to fold `Høstball` to `hostball`
 * and then refused by the validator would have nowhere to go, and the failure
 * would surface as an unexplained `invalid_input` rather than as the drift it
 * actually is.
 */

import { describe, expect, test } from "bun:test";
import { generateSlug } from "@repo/shared/utils/content-slug";
import { SLUG_PATTERN } from "./content";

/** Real BISO content shapes: Norwegian letters, punctuation, dashes, years. */
const TITLES = [
  "Høstball",
  "Vårfest på Blindern!",
  "BISO Bergen – Fadderullan 2026",
  "Økonomi & Ledelse: åpent møte",
  "Sommeravslutning (Trondheim)",
  "Karrieredagen — 2026",
];

describe("slug contract with @repo/shared", () => {
  for (const title of TITLES) {
    test(`the canonical slug for "${title}" passes the schema`, () => {
      const slug = generateSlug(title);
      expect(slug.length).toBeGreaterThan(0);
      expect(SLUG_PATTERN.test(slug)).toBe(true);
    });
  }

  test("the example in the tool description is the one the repo produces", () => {
    // Quoted verbatim in `biso_content_create_draft`'s `slug` description. If
    // the folding table ever changes, that description becomes wrong here
    // rather than in a reviewer's head.
    expect(generateSlug("Høstball")).toBe("hostball");
  });

  test("a title that folds away entirely is not silently accepted", () => {
    // `generateSlug` can legitimately return "" (an emoji-only title). The
    // schema's `.min(1)` rejects that, so the caller has to supply a slug — the
    // right outcome, and the reason the length assertion above is not enough on
    // its own.
    expect(generateSlug("🎉")).toBe("");
    expect(SLUG_PATTERN.test("")).toBe(false);
  });
});
