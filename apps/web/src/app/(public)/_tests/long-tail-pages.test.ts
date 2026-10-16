import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const PUBLIC = join(root, "src/app/(public)");

/**
 * RD-027 — the long-tail content pages.
 *
 * Ten routes onto the content template, plus `/[...slug]`, which is the block
 * editor's catch-all and is deliberately **not** on it: its blocks own their
 * own layout, and the package's contract is that editor rendering is unchanged.
 *
 * Merged with main since: `/bi-fondet` became `/okonomisk-stotte` (it 308s
 * there from `next.config.ts`), and the drug policy moved from
 * `/policies/drugs-policy` to `/about/drugs-policy` (the old address is a 308
 * route handler).
 */
const CONVERTED = [
  "privacy",
  "terms",
  "press",
  "contact",
  "business",
  "business-hotspot",
  "okonomisk-stotte",
  "documents",
  "students",
  "about/drugs-policy",
];

/** Biome's `noTemplateCurlyInString` fires on a literal `${`; these assertions
 * are about source text that contains one, so the marker is interpolated. */
const D = "$";
/** Hoisted: `useTopLevelRegex` forbids building this inside the assertion. */
const SECTION_ID = /^\s{4}id: "([a-z-]+)"/gm;
const OWN_TITLE = /export (async function generateMetadata|const metadata)/;
const BI_FONDET_REDIRECT =
  /source: "\/bi-fondet",\s*destination: "\/okonomisk-stotte",\s*permanent: true/;

function page(dir: string): string {
  return readFileSync(join(PUBLIC, dir, "page.tsx"), "utf8");
}

describe("the long-tail pages are Server Components", () => {
  it.each(CONVERTED)("%s renders on the server", (dir) => {
    const source = page(dir);
    expect(source).not.toContain('"use client"');
    expect(source).not.toContain('from "next-intl"');
    expect(source).toContain("export default async function");
  });

  it.each(CONVERTED)("%s uses the design system's header", (dir) => {
    const source = page(dir);
    expect(source).toContain("<PageHeader");
    // The three heroes this package retires.
    expect(source).not.toContain("AboutHero");
    expect(source).not.toContain("PublicPageHeader");
    expect(source).not.toContain("ShopHeroShell");
  });

  it.each(CONVERTED)("%s carries no scroll-triggered motion", (dir) => {
    const source = page(dir);
    expect(source).not.toContain("whileInView");
    expect(source).not.toContain("motion/react");
  });

  it.each(CONVERTED)("%s owns its own title", (dir) => {
    const source = page(dir);
    expect(source).toMatch(OWN_TITLE);
  });
});

describe("the client components these pages depended on are gone", () => {
  // Each existed only to fade sections in on scroll, or to hold a filter in
  // `useState`. Nothing else imported them.
  it.each([
    "business/business-page-client.tsx",
    "business-hotspot/business-hotspot-client.tsx",
    "students/students-page-client.tsx",
    "okonomisk-stotte/funding-support-page-client.tsx",
  ])("%s is deleted", (file) => {
    expect(existsSync(join(PUBLIC, file))).toBe(false);
  });

  it("retires the pre-redesign page header", () => {
    expect(
      existsSync(join(root, "src/components/public/public-page-header.tsx"))
    ).toBe(false);
  });

  it.each([
    "documents-hero.tsx",
    "documents-list-client.tsx",
    "document-row.tsx",
  ])("components/documents/%s is deleted", (file) => {
    expect(existsSync(join(root, "src/components/documents", file))).toBe(
      false
    );
  });
});

describe("the privacy statement", () => {
  const source = page("privacy");
  const content = readFileSync(
    join(PUBLIC, "privacy/_content/privacy-sections.ts"),
    "utf8"
  );

  it("is not hidden inside an accordion", () => {
    // Nineteen of twenty sections were collapsed on load: find-in-page could
    // not reach them, printing produced a page of headings, and
    // `/privacy#cookies` scrolled to a closed panel.
    expect(source).not.toContain("Accordion");
    expect(source).not.toContain("AccordionItem");
  });

  it("keeps every section reachable by its own anchor", () => {
    const ids = [...content.matchAll(SECTION_ID)].map((m) => m[1]);
    expect(ids.length).toBe(20);
    expect(new Set(ids).size).toBe(ids.length);
    // The contents list and the headings are generated from the same array,
    // so an anchor cannot drift from its target.
    expect(source).toContain(`href={\`#${D}{section.id}\`}`);
    expect(source).toContain("id={section.id}");
  });

  it("clears the fixed nav when an anchor is followed", () => {
    expect(source).toContain("scroll-mt-");
  });

  it("records PLACEHOLDER-012 rather than translating itself", () => {
    // The `privacy` namespace holds a different, five-section summary in both
    // locales. Substituting it would publish a shorter policy than the one
    // BISO wrote.
    expect(content).toContain("PLACEHOLDER-012");
  });

  it("does not stamp a review date it cannot vouch for", () => {
    expect(source).toContain("December 2024");
    expect(source).not.toContain("new Date()");
  });
});

describe("addresses that moved answer a real 308", () => {
  it("sends /policies/drugs-policy to /about/drugs-policy", () => {
    // A route handler, not a page calling `redirect()`: under
    // `cacheComponents` the page would flush a 200 shell first (RD-034).
    const alias = join(PUBLIC, "policies/drugs-policy");
    expect(existsSync(join(alias, "page.tsx"))).toBe(false);
    const route = readFileSync(join(alias, "route.ts"), "utf8");
    expect(route).toContain('"/about/drugs-policy"');
    expect(route).toContain("308");
  });

  it("serves /bi-fondet from the config redirect, with no page left behind", () => {
    expect(existsSync(join(PUBLIC, "bi-fondet"))).toBe(false);
    const config = readFileSync(join(root, "next.config.ts"), "utf8");
    expect(config).toMatch(BI_FONDET_REDIRECT);
  });
});

describe("dead controls this package removed", () => {
  it("gives every career-day card a real destination", () => {
    // Four prominent 'JOIN US' buttons had neither href nor handler. Each now
    // leads to that campus's Karrieredagene unit page, resolved from the unit
    // directory, falling back to the project page (main #87).
    const source = page("business");
    expect(source).toContain("careerDaysHrefs(units)");
    expect(source).toContain("href={careerDaysLinks[key]}");
    // An outage in the unit directory must not take the page down.
    expect(source).toContain("cachedPublicUnits(locale).catch(");
  });

  it("stops gating the Business Hotspot section on a campus cookie", () => {
    const source = page("business");
    expect(source).not.toContain("getActiveCampus");
    expect(source).not.toContain('=== "1"');
  });

  it("does not render the placeholder phone string as a phone number", () => {
    expect(page("business")).not.toContain(`campuses.${D}{key}.phone`);
  });

  it("keeps the funding page's links overridable from Appwrite", () => {
    // The prose is in the `fundingProgram` bundle; the `funding_programs` row
    // only overrides the volatile links, and every one falls back.
    const source = page("okonomisk-stotte");
    expect(source).toContain('getFundingProgramBySlug("bi-fondet")');
    expect(source).toContain("DEFAULT_PROGRAM_LINKS");
    expect(source).toContain('program.status !== "closed"');
  });

  it("answers the funding FAQ in a disclosure list, not an accordion widget", () => {
    const source = page("okonomisk-stotte");
    expect(source).toContain("<details");
    expect(source).toContain("<summary");
    expect(source).not.toContain("Accordion");
    expect(source).toContain("statusPanelPrimaryAction");
  });

  it("keeps the terms highlight guard, so an empty callout is not drawn", () => {
    // `sections.contact.highlight` is "" in both bundles.
    expect(page("terms")).toContain("highlight ? (");
  });
});

describe("documents", () => {
  const source = page("documents");

  it("filters through the URL, not through useState", () => {
    expect(source).toContain("<FilterChips");
    expect(source).toContain('param="category"');
    // A plain GET form, so search survives a reload and works without JS.
    expect(source).toContain("<FeedSearch");
    expect(source).toContain('action="/documents"');
  });

  it("opens the shelf and the campus a link asks for", () => {
    // `?category=` is validated by main's `resolveDocumentsFilters`; campus is
    // URL > cookie > all, national documents riding along with any campus.
    expect(source).toContain("resolveDocumentsFilters(");
    expect(source).toContain("resolveRequestCampus(sp.campus");
    expect(source).toContain("listPublishedDocuments({ campusId: campus })");
  });

  it("shows the current version and every earlier one", () => {
    const row = readFileSync(
      join(root, "src/components/documents/v2/document-row.tsx"),
      "utf8"
    );
    expect(row).toContain("displayDocumentVersion(doc.version)");
    expect(row).toContain("doc.previousVersions.map");
    expect(row).toContain("<details");
    expect(row).toContain(`download?version=${D}{version.id}`);
  });

  it("leaves the download and SharePoint routes untouched", () => {
    const row = readFileSync(
      join(root, "src/components/documents/v2/document-row.tsx"),
      "utf8"
    );
    expect(row).toContain("sharepoint_web_url");
    expect(
      readFileSync(
        join(root, "src/components/documents/v2/document-download.tsx"),
        "utf8"
      )
    ).toContain(`/api/documents/${D}{documentId}/download`);
  });

  it("records PLACEHOLDER-014 — the table is empty", () => {
    expect(source).toContain("PLACEHOLDER-014");
  });
});

describe("press", () => {
  const source = page("press");

  it("carries main's restructured press kit", () => {
    // d5da221d: an intro, a contact panel, previewed downloads named for the
    // background each logo is for, and do/don't usage lists.
    expect(source).toContain('t("intro.title")');
    expect(source).toContain('t("assets.downloadAria", { name })');
    expect(source).toContain('t.raw("usage.do")');
    expect(source).toContain('t.raw("usage.dont")');
    // The single usage paragraph it replaced is gone from both bundles.
    expect(source).not.toContain('t("usage.body")');
  });
});

describe("the block editor catch-all is untouched", () => {
  it("still renders PageDoc through @repo/editor, not through <Prose>", () => {
    // The plan proposed rendering authored pages into `<Prose>`. Every block
    // brings its own layout and background, so wrapping them would change
    // block rendering — which this package promised not to do.
    const rendered = readFileSync(
      join(PUBLIC, "[...slug]/_components/rendered-page.tsx"),
      "utf8"
    );
    expect(rendered).toContain("@repo/editor/render");
    expect(rendered).not.toContain("<Prose");
  });

  it("still answers an unknown slug with a real 404", () => {
    const source = page("[...slug]");
    expect(source).toContain("export const instant = false");
    expect(source).toContain("notFound()");
  });
});

/**
 * Merged with main. The redesign had reduced `/students` to an index of links;
 * main (#63, #87) rebuilt it with its own sections — benefits, units, funding,
 * upcoming events, open positions — and the merge keeps main's sections on the
 * redesign's primitives. What the redesign was guarding against still holds:
 * the feeds are scoped server-side rather than fetched site-wide and sliced,
 * and a section with no data is omitted rather than promised.
 */
describe("/students carries main's sections without the redesign's traps", () => {
  const source = page("students");
  const sections = readFileSync(
    join(PUBLIC, "students/_components/student-sections.tsx"),
    "utf8"
  );

  it("scopes its feeds by campus on the server and shows only what is ahead", () => {
    expect(source).toContain("resolveRequestCampus(sp.campus");
    expect(source).toContain("upcomingOnly: true");
    expect(source).not.toContain("getDepartments");
    expect(source).not.toContain("useCampus");
  });

  it("omits the benefits block while campus_data has nothing to show", () => {
    // `campus_data` was empty when the redesign audited it; the block renders
    // only when a campus (or the national row) has entries, and points at the
    // full list on /membership#fordeler.
    expect(sections).toContain("cards.length === 0");
    expect(source).toContain("/membership#fordeler");
  });
});
