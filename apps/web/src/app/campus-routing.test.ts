import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { codeOnly } from "@/test/source";

const read = (f: string) =>
  codeOnly(readFileSync(join(import.meta.dirname, f), "utf8"));
const sitemap = read("sitemap.ts");
// Every feed that scopes by `?campus=` server-side. `/units` and `/shop`
// joined the first three at RD-025 — verified in RD-033, which also found they
// had never been given the canonical the other three carry.
const feeds = {
  events: read("(public)/events/page.tsx"),
  news: read("(public)/news/page.tsx"),
  jobs: read("(public)/jobs/page.tsx"),
  units: read("(public)/units/page.tsx"),
  shop: read("(public)/shop/page.tsx"),
};
const campusPage = read("(public)/campus/[slug]/page.tsx");

const CAMPUS_LANDING_URL = /\/campus\/\$\{slug\}/;
const SCOPED_FEED_URL = /\?campus=\$\{slug\}/;

describe("campus routing (RD-016)", () => {
  it("scopes every feed that has a campus dimension", () => {
    // /projects is the one feed that stays out: it has no campus_id, only a
    // campusConfigs JSON blob, so it cannot be scoped honestly at all.
    for (const [name, source] of Object.entries(feeds)) {
      expect(source, name).toContain("resolveRequestCampus(sp.campus");
    }
  });

  it("404s an unrecognised campus instead of showing everything", () => {
    // `?campus=osloo` must not quietly return national content the URL does
    // not describe.
    for (const [name, source] of Object.entries(feeds)) {
      expect(source, name).toContain("if (campus === undefined)");
      expect(source, name).toContain("notFound()");
    }
  });

  it("points a scoped feed's canonical at the unscoped URL", () => {
    // A scoped feed is a filtered view of the same collection; it should not
    // compete with the canonical listing in search.
    for (const [name, source] of Object.entries(feeds)) {
      expect(source, name).toContain(`canonical: "/${name}"`);
    }
  });

  it("does not set dynamicParams, which cacheComponents forbids", () => {
    // An unknown slug still 404s via notFound() in the page body.
    expect(campusPage).not.toContain("dynamicParams");
    expect(campusPage).toContain("generateStaticParams");
    expect(campusPage).toContain("notFound()");
  });

  it("builds the campus landing page from real localised metadata", () => {
    // campus_metadata carries tagline/description/highlights/focusAreas per
    // locale and was near-unused. Nothing here is invented copy.
    expect(campusPage).toContain("getCampusMetadata");
    expect(campusPage).toContain('locale === "no" ? "_nb" : "_en"');
  });

  it("lists campus pages and scoped feeds in the sitemap", () => {
    expect(sitemap).toContain("CAMPUS_SLUGS.flatMap");
    // Built as template literals in the source; match without writing a
    // placeholder in a plain string, which the linter reads as a mistake.
    expect(sitemap).toMatch(CAMPUS_LANDING_URL);
    expect(sitemap).toMatch(SCOPED_FEED_URL);
  });

  it("keeps every pre-existing sitemap URL", () => {
    // Additive only: a redesign that drops an indexed URL is a failed redesign.
    for (const path of [
      "/jobs",
      "/events",
      "/news",
      "/shop",
      "/about",
      "/campus",
      "/membership",
      "/units",
      "/projects",
      "/privacy",
      "/terms",
    ]) {
      expect(sitemap).toContain(`${path}\``);
    }
  });
});
