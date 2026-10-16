import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CAMPUS_SLUGS } from "@/lib/campus-scope";

const root = process.cwd();
const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;
const LINE_COMMENT = /^\s*\/\/.*$/gm;
const PLUS_COUNT = /\d\+/;
const CAMPUS_EXPORT = /^\s{2}campus,$/m;

/** Doc comments name what is being replaced, so assertions read code. */
function code(path: string): string {
  return readFileSync(join(root, path), "utf8")
    .replace(BLOCK_COMMENT, "")
    .replace(LINE_COMMENT, "");
}

const landing = code("src/components/campus/v2/campus-landing.tsx");
const index = code("src/components/campus/v2/campus-index.tsx");
const indexPage = code("src/app/(public)/campus/page.tsx");
const slugPage = code("src/app/(public)/campus/[slug]/page.tsx");
// Main's unit directory: the redesign's own `campus-landing.ts` reader fixed
// the same bug independently and was retired in favour of it.
const unitsReader = code("src/lib/data/units.ts");

describe("PLACEHOLDER-009 — campus editorial content does not exist", () => {
  it("renders every editorial field only when it arrives", () => {
    // `campus_metadata` and `campus_data` were empty tables when this page was
    // built, so tagline, description, highlights, focus areas, benefits and
    // the partnership offer may all be absent. None may be stubbed, and none
    // may leave an empty heading behind — that includes the blocks the merge
    // carried over from main's `/campus` tabs.
    for (const field of [
      "highlights",
      "focusAreas",
      "benefitGroups",
      "businessBenefits",
      "leadership",
    ]) {
      expect(landing).toContain(`${field}.length > 0`);
    }
    expect(landing).toContain("description ?? undefined");
  });

  it("invents no counts", () => {
    // PLACEHOLDER-004: "25+ societies · 120+ events/yr · 3000+ students" have
    // no source. Units, published events and open positions here do.
    expect(landing).toContain('t("stats.units")');
    expect(landing).toContain('t("stats.events")');
    expect(landing).toContain('t("stats.jobs")');
    expect(landing).toContain("stat.count > 0");
    expect(landing).not.toMatch(PLUS_COUNT);
  });
});

describe("campus units come from the department rows", () => {
  it("does not read through the empty department translation table", () => {
    // `getDepartments()` filters `content_translations` by
    // `content_type = "department"`, and that table holds **zero** department
    // rows — so every consumer renders an empty list while 141 active
    // departments sit in `departments`.
    expect(unitsReader).toContain('"departments"');
    expect(unitsReader).toContain('Query.equal("active", true)');
    expect(unitsReader).toContain(".filter(isPublicUnit)");
    expect(slugPage).toContain("cachedPublicUnits");
    expect(slugPage).not.toContain("getDepartments");
  });

  it("shows a unit only through the shared card", () => {
    // Main's #87 let a unit's logo fill its tile once units started uploading
    // them; `UnitCard` (via `UnitCrest`) owns that, with the name-derived
    // monogram as the stand-in. The landing itself reads no raw unit column.
    expect(landing).toContain("<UnitCard");
    for (const column of ["unit.logoUrl", "unit.type", "unit.description"]) {
      expect(landing).not.toContain(column);
    }
  });
});

describe("the index links every campus", () => {
  it("renders one link per slug", () => {
    expect(index).toContain(["href={`/campus/", "{campus.slug}`}"].join("$"));
    expect(indexPage).toContain("CAMPUS_SLUGS.map");
    expect(CAMPUS_SLUGS).toHaveLength(5);
  });

  it("replaces the cookie-bound tabbed view outright (RD-030)", () => {
    // v1 rendered whichever campus the cookie held, with no way to reach
    // another. It is deleted, not switched away from.
    expect(indexPage).not.toContain("isShellV2Enabled");
    expect(indexPage).not.toContain("<CampusPageClient");
    expect(indexPage).toContain("<CampusIndex");
  });
});

describe("the page scopes its feeds to the campus", () => {
  it("passes the campus id to every scopeable feed", () => {
    for (const feed of ["listEvents", "listNews", "listJobs"]) {
      const from = slugPage.indexOf(`${feed}(`);
      expect(from, feed).toBeGreaterThan(-1);
      expect(
        slugPage.slice(from, slugPage.indexOf("})", from)),
        feed
      ).toContain("campus: campus.id");
    }
  });

  it("offers no campus filter for a feed that cannot carry one", () => {
    // `/projects` has no `campus_id`; inventing that filter would invent a
    // dimension the data does not have.
    expect(landing).not.toContain("/projects?campus=");
  });
});

describe("campus message bundle", () => {
  const bundle = (locale: string) =>
    JSON.parse(
      readFileSync(
        join(root, `../../packages/i18n/messages/${locale}/campus.json`),
        "utf8"
      )
    ) as Record<string, unknown>;

  it("keeps the two locales at key parity", () => {
    const flatten = (value: unknown, prefix = ""): string[] =>
      typeof value === "object" && value !== null
        ? Object.entries(value).flatMap(([key, child]) =>
            flatten(child, `${prefix}${key}.`)
          )
        : [prefix];
    expect(flatten(bundle("en")).sort()).toEqual(flatten(bundle("no")).sort());
  });

  it("is registered as a namespace, or none of it renders", () => {
    // A message file on disk that no `messages/{locale}.ts` imports loads
    // nothing: the page rendered the literal key `campus.index.title`.
    for (const locale of ["en", "no"]) {
      const module = readFileSync(
        join(root, `../../packages/i18n/messages/${locale}.ts`),
        "utf8"
      );
      expect(module, locale).toContain(`./${locale}/campus.json`);
      expect(module, locale).toMatch(CAMPUS_EXPORT);
    }
    expect(
      readFileSync(join(root, "../../packages/i18n/messages/index.ts"), "utf8")
    ).toContain('"campus"');
  });

  it("stops borrowing unrelated keys for its headings", () => {
    // The RD-016 stub labelled highlights with `common.footer.headings.about`
    // and focus areas with `common.navigation.triggers.about` ("About BISO").
    expect(landing).not.toContain("footer.headings");
    expect(landing).not.toContain("triggers.about");
  });
});
