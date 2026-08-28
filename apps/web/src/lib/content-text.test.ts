import { describe, expect, it } from "vitest";
import {
  buildTeaser,
  decodeHtmlEntities,
  toPlainText,
  toSentenceExcerpt,
  truncateAtWord,
} from "@/lib/content-text";

describe("decodeHtmlEntities", () => {
  it("resolves decimal, hex, and named references", () => {
    expect(decodeHtmlEntities("BISO&#039;s &#x2019;hub&#8221;")).toBe(
      "BISO's ’hub”"
    );
    expect(decodeHtmlEntities("Q&amp;A &ndash; caf&eacute;")).toBe(
      "Q&A – caf&eacute;"
    );
  });

  it("leaves unresolvable references untouched", () => {
    expect(decodeHtmlEntities("&#0; &notanentity")).toBe("&#0; &notanentity");
  });
});

describe("toPlainText", () => {
  it("separates block-level text instead of gluing it together", () => {
    expect(
      toPlainText(
        "<p>Come meet BISO and the people that run it.</p><p>BISO&#039;s open recruitment hub.</p>"
      )
    ).toBe(
      "Come meet BISO and the people that run it. BISO's open recruitment hub."
    );
  });

  it("flattens Plate JSON without re-decoding authored entities", () => {
    expect(toPlainText('[{"children":[{"text":"Q&amp;A night"}]}]')).toBe(
      "Q&amp;A night"
    );
  });

  it("returns an empty string for missing copy", () => {
    expect(toPlainText(null)).toBe("");
    expect(toPlainText(undefined)).toBe("");
  });
});

describe("truncateAtWord", () => {
  it("keeps short text intact", () => {
    expect(truncateAtWord("Short teaser", 40)).toBe("Short teaser");
  });

  it("cuts on a word boundary", () => {
    expect(truncateAtWord("one two three four", 12)).toBe("one two…");
  });
});

describe("toSentenceExcerpt", () => {
  it("stops on the last full sentence inside the budget", () => {
    const body =
      "Come meet BISO and the people that run it. This is the open recruitment hub at BI Campus Oslo. A third sentence that overflows the budget entirely.";
    expect(toSentenceExcerpt(body, 110)).toBe(
      "Come meet BISO and the people that run it. This is the open recruitment hub at BI Campus Oslo."
    );
  });

  it("falls back to a word cut when the first sentence overflows", () => {
    const body =
      "A single very long opening sentence that keeps running well past the budget without any punctuation at all";
    expect(toSentenceExcerpt(body, 40)).toBe(
      "A single very long opening sentence…"
    );
  });
});

describe("buildTeaser", () => {
  it("prefers the editor-written teaser over the body", () => {
    expect(
      buildTeaser(
        "  Apply to any BISO committee.  ",
        "<p>A much longer description body.</p>",
        180
      )
    ).toBe("Apply to any BISO committee.");
  });

  it("cleans entities and markup out of the teaser itself", () => {
    expect(buildTeaser("<em>BISO&#039;s</em> hub", null, 180)).toBe(
      "BISO's hub"
    );
  });

  it("falls back to the body opening when no teaser is authored", () => {
    const body =
      "<p>Come meet BISO and the people that run it.</p><p>BISO&#039;s open recruitment hub at BI Campus Oslo is where students can apply directly to join any of BISO&#039;s committees, academic associations and boards.</p>";

    // The old hero produced "…run it.BISO&#039;s open recruitment hub … as"
    // — glued sentences, raw entities, and a cut mid-word.
    expect(buildTeaser("", body, 180)).toBe(
      "Come meet BISO and the people that run it."
    );
  });

  it("returns an empty string when there is nothing to show", () => {
    expect(buildTeaser(null, null, 180)).toBe("");
  });
});
