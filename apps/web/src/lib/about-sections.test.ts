import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ABOUT_REDIRECTS, ABOUT_SECTIONS } from "./about-sections";

const ABOUT_DIR = join(import.meta.dirname, "../app/(public)/about");
const ANCHOR_TARGET = /^\/about#[a-z-]+$/;
const PLAIN_SLUG = /^[a-z]+$/;

describe("the merged Om BISO page", () => {
  it("sends every retired subpage to a section that exists", () => {
    // The subpages were folded into /about. Old links, bookmarks and the
    // nav must land on the matching section, not on a 404 or the top.
    const source = [
      readFileSync(join(ABOUT_DIR, "page.tsx"), "utf8"),
      ...ABOUT_SECTIONS.map((section) =>
        readFileSync(
          join(
            import.meta.dirname,
            `../components/about/sections/${section.component}.tsx`
          ),
          "utf8"
        )
      ),
    ].join("\n");

    for (const [slug, target] of Object.entries(ABOUT_REDIRECTS)) {
      expect(target, slug).toMatch(ANCHOR_TARGET);
      const id = target.split("#")[1];
      expect(
        ABOUT_SECTIONS.map((section) => section.id),
        slug
      ).toContain(id);
    }
    for (const section of ABOUT_SECTIONS) {
      expect(source, section.id).toContain(`id="${section.id}"`);
    }
  });

  it("retires each old subpage route with a redirect", () => {
    for (const slug of Object.keys(ABOUT_REDIRECTS)) {
      const page = readFileSync(join(ABOUT_DIR, slug, "page.tsx"), "utf8");
      expect(page, slug).toContain("redirect(");
      // Dot access for plain slugs, bracket access for hyphenated ones.
      const access = PLAIN_SLUG.test(slug)
        ? `ABOUT_REDIRECTS.${slug}`
        : `ABOUT_REDIRECTS["${slug}"]`;
      expect(page, slug).toContain(access);
    }
  });
});
