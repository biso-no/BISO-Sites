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
 */
const CONVERTED = [
  "privacy",
  "terms",
  "press",
  "contact",
  "business",
  "business-hotspot",
  "bi-fondet",
  "documents",
  "students",
  "policies/drugs-policy",
];

/** Biome's `noTemplateCurlyInString` fires on a literal `${`; these assertions
 * are about source text that contains one, so the marker is interpolated. */
const D = "$";
/** Hoisted: `useTopLevelRegex` forbids building this inside the assertion. */
const SECTION_ID = /^\s{4}id: "([a-z-]+)"/gm;
const OWN_TITLE = /export (async function generateMetadata|const metadata)/;

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
  ])("%s is deleted", (file) => {
    expect(existsSync(join(PUBLIC, file))).toBe(false);
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

describe("dead controls this package removed", () => {
  it("gives every career-day card a real destination", () => {
    // Four prominent 'JOIN US' buttons had neither href nor handler.
    const source = page("business");
    expect(source).toContain(
      `mailto:${D}{t(\`contact.campuses.${D}{key}.email\`)}`
    );
  });

  it("stops gating the Business Hotspot section on a campus cookie", () => {
    const source = page("business");
    expect(source).not.toContain("getActiveCampus");
    expect(source).not.toContain('=== "1"');
  });

  it("does not render the placeholder phone string as a phone number", () => {
    expect(page("business")).not.toContain(`campuses.${D}{key}.phone`);
  });

  it("asks for a funding key that exists", () => {
    // `overview.rows` is in neither bundle; the key is `overview.documents`.
    const source = page("bi-fondet");
    expect(source).not.toContain('t("overview.rows")');
    expect(source).toContain('t("overview.documents")');
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
    expect(source).toContain('<form action="/documents"');
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

describe("the duplication between /students and /campus is resolved", () => {
  const source = page("students");

  it("stops restating the campus feeds", () => {
    // `/campus/<slug>`, `/events` and `/jobs` are the canonical lists; this
    // page links to them instead of fetching and rendering them again.
    expect(source).not.toContain("listEvents");
    expect(source).not.toContain("listJobs");
    expect(source).not.toContain("getDepartments");
  });

  it("stops reading the empty campus_data table for benefits", () => {
    // `campus_data` holds zero rows, so the benefits block rendered nothing.
    // The 18 real rows are on /membership#fordeler, where this now points.
    expect(source).not.toContain("getGlobalMembershipBenefits");
    expect(source).toContain("/membership#fordeler");
  });
});
