import { describe, expect, it } from "vitest";
import { serializeJsonLd } from "./json-ld";

describe("serializeJsonLd", () => {
  it("escapes a script-closing sequence in editor content", () => {
    const serialized = serializeJsonLd({
      headline: "</script><script>alert(1)</script>",
    });

    expect(serialized).not.toContain("</script>");
    expect(serialized).not.toContain("<");
    expect(JSON.parse(serialized)).toEqual({
      headline: "</script><script>alert(1)</script>",
    });
  });

  it("escapes ampersands and line separators without changing the value", () => {
    const payload = { description: "R&D\u2028next\u2029line" };

    const serialized = serializeJsonLd(payload);

    expect(serialized).toContain("\\u0026");
    expect(serialized).toContain("\\u2028");
    expect(serialized).toContain("\\u2029");
    expect(JSON.parse(serialized)).toEqual(payload);
  });

  it("leaves ordinary payloads intact", () => {
    expect(serializeJsonLd({ "@type": "NewsArticle", headline: "Hei" })).toBe(
      '{"@type":"NewsArticle","headline":"Hei"}'
    );
  });
});
