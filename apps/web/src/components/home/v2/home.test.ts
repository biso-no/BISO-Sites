import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { codeOnly } from "@/test/source";

const read = (f: string) =>
  codeOnly(readFileSync(join(import.meta.dirname, f), "utf8"));
const hero = read("hero-chevron.tsx");
const home = read("home-v2.tsx");
const overview = read("overview-section.tsx");
const leadership = read("leadership-section.tsx");
const campusSections = read("campus-sections.tsx");
const membership = read("membership-band.tsx");
const partnerGrid = read("partner-grid.tsx");
const page = read("../../../app/(public)/page.tsx");
const sections = {
  hero,
  home,
  overview,
  leadership,
  campusSections,
  membership,
  partnerGrid,
};
const CAMPUS_LINK = /\/campus\/\$\{slug\}/;

const globals = readFileSync(
  join(import.meta.dirname, "../../../../../../packages/ui/styles/globals.css"),
  "utf8"
);

describe("home (RD-018)", () => {
  it("has no scroll-triggered reveals", () => {
    // The 19 whileInView uses in the old home components are not carried over,
    // and the campus overview sections batch G added came across without them.
    for (const [name, source] of Object.entries(sections)) {
      expect(source, name).not.toContain("whileInView");
    }
  });

  it("skips the orchestrated moment entirely under reduced motion", () => {
    // Not a shortened animation — none at all.
    expect(hero).toContain("useReducedMotion");
    expect(hero).toContain("prefersReduced ? undefined :");
  });

  it("renders only stats that come from real data", () => {
    // PLACEHOLDER-004: no member count, and a zero drops the figure rather
    // than showing "0 open positions". The live counts moved from the hero to
    // the overview section with the rest of the campus overview (batch G).
    expect(overview).toContain("filter((stat) => stat.value > 0)");
    expect(overview).not.toContain("1000+");
    expect(hero).not.toContain("1000+");
  });

  it("derives the event status pill from the data", () => {
    // "Register" vs "Info only" comes from whether a ticket_url exists, and a
    // members-only event is listed and marked rather than hidden.
    expect(home).toContain("event.ticket_url ?");
    expect(home).toContain("event.member_only ?");
  });

  it("keeps the campus claim honest by linking it", () => {
    // The design states the campus; that is only truthful if the campus has a
    // URL, which is what RD-016 added.
    expect(hero).toContain("campusIdToSlug");
    expect(hero).toMatch(CAMPUS_LINK);
  });

  it("names the campus the page is scoped to, with National as no campus", () => {
    // The headline follows the page's own `?campus=` > cookie resolution, so a
    // shared `/?campus=bergen` link names Bergen above Bergen's feeds; the
    // cookie-only context could name a different campus.
    expect(page).toContain("resolveRequestCampus(sp.campus");
    expect(page).toContain("campusKey !== NATIONAL_CAMPUS_ID");
    expect(hero).not.toContain("useCampus");
  });

  it("caps and hyphenates the display scale for compound languages", () => {
    // Norwegian compounds are single unbreakable tokens: at 6.5rem
    // "studentstemme" was wider than its grid cell and overflowed into the
    // hero collage. English never showed it. Museo Slab is wider still, so the
    // scale and the heading's own 16ch cap were re-measured together.
    expect(globals).toContain("clamp(2.125rem, 5.5vw, 4rem)");
    expect(read("hero-chevron.tsx")).toContain("max-w-[16ch]");
    expect(globals).toContain("hyphens: auto");
  });

  it("omits sections whose source is empty rather than faking them", () => {
    expect(home).toContain("partners.length > 0 &&");
    expect(partnerGrid).toContain("partners.length === 0");
    // campus_metadata is empty today (PLACEHOLDER-009).
    expect(overview).toContain("focusAreas.length > 0");
    expect(leadership).toContain("members.length === 0");
    expect(campusSections).toContain("jobs.length === 0");
    expect(campusSections).toContain("units.length === 0");
  });

  it("streams the leadership board and keeps its failure out of the cache", () => {
    // Its own Suspense boundary, so a slow directory never holds the page; the
    // cached reader throws by design, and the fallback lives at the call site.
    expect(home).toContain("<Suspense fallback={<LeadershipSkeleton />}>");
    expect(leadership).toContain("await cachedUnitBoard(");
    expect(leadership).toContain("catch {");
    expect(page).not.toContain("cachedUnitBoard");
  });

  it("asks only non-members to join, and never quotes a static price", () => {
    // The header's rule: the CTA is shown to someone who can act on it.
    expect(home).toContain(
      "isMember ? null : <MembershipBand items={joinItems} />"
    );
    expect(hero).toContain('href="/member"');
    // `/membership` sells the plans in the `memberships` table; the bundle's
    // `durations` prices are not the live ones.
    expect(membership).not.toContain("durations");
    expect(membership).toContain("JoinLink");
  });
});
