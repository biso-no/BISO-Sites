import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { codeOnly } from "@/test/source";

const read = (f: string) =>
  codeOnly(readFileSync(join(import.meta.dirname, f), "utf8"));
const hero = read("hero-chevron.tsx");
const home = read("home-v2.tsx");
const CAMPUS_LINK = /\/campus\/\$\{slug\}/;

const globals = readFileSync(
  join(import.meta.dirname, "../../../../../../packages/ui/styles/globals.css"),
  "utf8"
);

describe("home (RD-018)", () => {
  it("has no scroll-triggered reveals", () => {
    // The 19 whileInView uses in the old home components are not carried over.
    expect(hero).not.toContain("whileInView");
    expect(home).not.toContain("whileInView");
  });

  it("skips the orchestrated moment entirely under reduced motion", () => {
    // Not a shortened animation — none at all.
    expect(hero).toContain("useReducedMotion");
    expect(hero).toContain("prefersReduced ? undefined :");
  });

  it("renders only stats that come from real data", () => {
    // PLACEHOLDER-004: no member count, and a zero drops the tile rather than
    // showing "0 campuses".
    expect(hero).toContain("filter((stat) => stat.value > 0)");
    expect(hero).not.toContain("1000+");
  });

  it("derives the event status pill from the data", () => {
    // "Register" vs "Info only" comes from whether a ticket_url exists.
    expect(home).toContain("event.ticket_url ?");
  });

  it("keeps the campus claim honest by linking it", () => {
    // The design states the campus; that is only truthful if the campus has a
    // URL, which is what RD-016 added.
    expect(hero).toContain("campusIdToSlug");
    expect(hero).toMatch(CAMPUS_LINK);
  });

  it("caps and hyphenates the display scale for compound languages", () => {
    // Norwegian compounds are single unbreakable tokens: at 6.5rem
    // "studentstemme" was wider than its grid cell and overflowed into the
    // hero collage. English never showed it.
    expect(globals).toContain("clamp(2.5rem, 7vw, 5rem)");
    expect(globals).toContain("hyphens: auto");
  });

  it("omits sections whose source is empty rather than faking them", () => {
    expect(home).toContain("partners.length > 0 &&");
  });
});
