import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PageThemeStyle } from "./page-theme-style";

describe("PageThemeStyle", () => {
  it("renders nothing for null", () => {
    expect(renderToStaticMarkup(<PageThemeStyle theme={null} />)).toBe("");
  });

  it("renders one plain style carrying the overrides", () => {
    const html = renderToStaticMarkup(
      <PageThemeStyle theme={{ dark: "#3b1c6b", accent: "#c8a2f0" }} />
    );
    expect(html.match(/<style/g)).toHaveLength(1);
    expect(html.startsWith("<style>:root{")).toBe(true);
    expect(html).toContain("--biso-deep:#3b1c6b");
    expect(html).not.toContain("href=");
    expect(html).not.toContain("precedence");
  });
});
