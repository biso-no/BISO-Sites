import { CODED_PAGES } from "@repo/shared/search/coded-pages";
import { describe, expect, it } from "vitest";
import { STATIC_SITEMAP_PATHS } from "./sitemap-static";

describe("static sitemap paths", () => {
  it("are all searchable coded pages", () => {
    const coded = new Set(CODED_PAGES.map((p) => p.path));
    for (const path of STATIC_SITEMAP_PATHS) {
      expect(coded.has(path), `${path} missing from CODED_PAGES`).toBe(true);
    }
  });

  it("leave out the /about redirects", () => {
    expect(STATIC_SITEMAP_PATHS.some((p) => p.startsWith("/about/"))).toBe(
      false
    );
  });
});
