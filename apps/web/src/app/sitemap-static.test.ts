import { CODED_PAGES } from "@repo/shared/search/coded-pages";
import { describe, expect, it } from "vitest";
import { PROJECT_HUB_SLUGS } from "@/lib/project-hub";
import { STATIC_SITEMAP_PATHS } from "./sitemap-static";

describe("static sitemap paths", () => {
  it("are all searchable coded pages", () => {
    const coded = new Set(CODED_PAGES.map((p) => p.path));
    for (const path of STATIC_SITEMAP_PATHS) {
      expect(coded.has(path), `${path} missing from CODED_PAGES`).toBe(true);
    }
  });

  it("match CODED_PAGES exactly, with the project hubs", () => {
    // Every coded page is a sitemap page or a coded project hub, so a page
    // removed from the site cannot linger in search.
    const hubs = PROJECT_HUB_SLUGS.map((slug) => `/projects/${slug}`);
    expect(new Set(CODED_PAGES.map((p) => p.path))).toEqual(
      new Set([...STATIC_SITEMAP_PATHS, ...hubs])
    );
  });

  it("leave out the /about redirects", () => {
    expect(STATIC_SITEMAP_PATHS.some((p) => p.startsWith("/about/"))).toBe(
      false
    );
  });
});
