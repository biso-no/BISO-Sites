import { describe, expect, test } from "bun:test";
import {
  decodeEntities,
  normalizeDescriptionHtml,
  plainTextExcerpt,
} from "./html";

describe("decodeEntities", () => {
  test("decodes numeric entities WordPress emits in titles", () => {
    expect(decodeEntities("Booklocker &#8211; Campus Oslo")).toBe(
      "Booklocker – Campus Oslo"
    );
  });

  test("decodes named entities", () => {
    expect(decodeEntities("Marketing &amp; PR")).toBe("Marketing & PR");
  });

  test("decodes hex entities", () => {
    expect(decodeEntities("caf&#x e9;".replace(" ", ""))).toBe("café");
  });
});

describe("normalizeDescriptionHtml", () => {
  test("keeps Gutenberg paragraphs and strips inline markup and classes", () => {
    const input =
      '<p class="wp-block-paragraph"><strong>BI Student Organisation Bergen</strong></p>';

    expect(normalizeDescriptionHtml(input).html).toBe(
      "<p>BI Student Organisation Bergen</p>"
    );
  });

  test("collapses every heading level to h3, matching the serializer", () => {
    expect(normalizeDescriptionHtml("<h1>Om oss</h1>").html).toBe(
      "<h3>Om oss</h3>"
    );
    expect(normalizeDescriptionHtml("<h5>Om oss</h5>").html).toBe(
      "<h3>Om oss</h3>"
    );
  });

  test("groups consecutive list items into a single ul", () => {
    const input = "<ul><li>Ett</li><li>To</li></ul>";

    expect(normalizeDescriptionHtml(input).html).toBe(
      "<ul><li>Ett</li><li>To</li></ul>"
    );
  });

  test("rescues unsupported containers into paragraphs instead of dropping them", () => {
    const input = "<div>Viktig informasjon</div>";

    expect(normalizeDescriptionHtml(input).html).toBe(
      "<p>Viktig informasjon</p>"
    );
  });

  test("converts plain-text content with blank-line breaks into paragraphs", () => {
    const input = "Første avsnitt\n\n\n\nAndre avsnitt";

    expect(normalizeDescriptionHtml(input).html).toBe(
      "<p>Første avsnitt</p><p>Andre avsnitt</p>"
    );
  });

  test("escapes text so the output round-trips through the studio parser", () => {
    expect(normalizeDescriptionHtml("<p>Ben & Jerry</p>").html).toBe(
      "<p>Ben &amp; Jerry</p>"
    );
  });

  test("drops empty blocks", () => {
    expect(normalizeDescriptionHtml("<p></p><p>Tekst</p>").html).toBe(
      "<p>Tekst</p>"
    );
  });

  test("truncates on a block boundary and reports it", () => {
    const long = `<p>${"a".repeat(60)}</p><p>${"b".repeat(60)}</p>`;
    const result = normalizeDescriptionHtml(long, 80);

    expect(result.truncated).toBe(true);
    expect(result.html).toBe(`<p>${"a".repeat(60)}</p>`);
    expect(result.html.length).toBeLessThanOrEqual(80);
  });

  test("returns an empty paragraph for empty input rather than throwing", () => {
    expect(normalizeDescriptionHtml("").html).toBe("<p></p>");
  });
});

describe("plainTextExcerpt", () => {
  test("strips markup and truncates on a word boundary", () => {
    const input = "<p>Karrieredagene rekrutterer en ny manager for 2026</p>";

    expect(plainTextExcerpt(input, 30)).toBe("Karrieredagene rekrutterer…");
  });
});
