import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { codeOnly } from "@/test/source";

const root = process.cwd();
const ABOUT = join(root, "src/app/(public)/about");
const SECTIONS = join(root, "src/components/about/sections");

/**
 * RD-026 converted the about subtree from Client to Server Components. Main's
 * Branding Committee batch D then merged most of it into ONE page, `/about`,
 * with a section per former subpage. What is left of the subtree is two kinds
 * of directory, and this file pins both:
 *
 * - **pages** — the drug and alcohol policy and the academics contact, which
 *   stayed pages, each a Server Component on the design system's header;
 * - **retired addresses** — the folded subpages and the bylaws, each a route
 *   handler answering a real 308 (to its section, or to the bylaws shelf on
 *   /documents). A `page.tsx` beside one would shadow it.
 */
const PAGES = ["academics-contact", "drugs-policy"];

const RETIRED = [
  "alumni",
  "bylaws",
  "history",
  "operations",
  "politics",
  "saih",
  "study-quality",
  "what-is-biso",
];

function page(dir: string): string {
  return readFileSync(join(ABOUT, dir, "page.tsx"), "utf8");
}

describe("the about pages are Server Components", () => {
  it.each(PAGES)("%s renders on the server", (dir) => {
    const source = page(dir);
    expect(source).not.toContain('"use client"');
    expect(source).not.toContain('next-intl"');
    expect(source).toContain("next-intl/server");
    expect(source).toContain("export default async function");
  });

  it.each(PAGES)("%s carries its own metadata", (dir) => {
    // A metadata-only layout existed only because a client page cannot export
    // metadata. A server page owns its own, so no layout sits beside it.
    expect(page(dir)).toContain("export async function generateMetadata");
    expect(existsSync(join(ABOUT, dir, "layout.tsx")), dir).toBe(false);
  });

  it.each(PAGES)("%s uses the design system's header", (dir) => {
    const source = page(dir);
    expect(source).toContain("<PageHeader");
    expect(source).not.toContain("AboutHero");
    expect(source).not.toContain("PublicPageHeader");
  });

  it.each(PAGES)("%s carries no scroll-triggered motion", (dir) => {
    // `whileInView` is the pattern the brief names as the generic default to
    // remove, and it is also what forced these pages to be client components.
    const source = page(dir);
    expect(source).not.toContain("whileInView");
    expect(source).not.toContain("motion/react");
  });
});

describe("the retired subpages answer a real 308", () => {
  it.each(RETIRED)("%s is a route handler, not a page", (dir) => {
    // Under `cacheComponents` a page calling `redirect()` flushes a 200 shell
    // first, so the hop degrades to a client-side one (RD-034).
    expect(existsSync(join(ABOUT, dir, "page.tsx"))).toBe(false);
    const route = readFileSync(join(ABOUT, dir, "route.ts"), "utf8");
    expect(route).toContain("export function GET");
    expect(route).toContain("308");
  });

  it("sends the bylaws to their shelf on /documents", () => {
    const route = readFileSync(join(ABOUT, "bylaws/route.ts"), "utf8");
    expect(route).toContain('"/documents?category=campus-bylaws"');
  });
});

describe("the merged Om BISO page", () => {
  const hub = readFileSync(join(ABOUT, "page.tsx"), "utf8");

  it("is a Server Component that owns its metadata", () => {
    expect(hub).not.toContain('"use client"');
    expect(hub).toContain("export async function generateMetadata");
    expect(hub).toContain("<PageHeader");
    expect(hub).not.toContain("whileInView");
  });

  it("fetches partners and the org chart on the server", () => {
    // Main's merged page loaded both in a `useEffect`, so it shipped without
    // them and filled in after hydration. `codeOnly`: the page's doc comment
    // names the hook it replaced.
    expect(codeOnly(hub)).not.toContain("useEffect");
    expect(hub).toContain("getPartners()");
    expect(hub).toContain("getOrgChartUrl()");
  });

  it("lays the section menu out as the content template's rail", () => {
    // Sticky everywhere: a column beside the sections from `lg`, a strip under
    // the fixed header below it.
    expect(hub).toContain("<AboutSectionNav");
    const nav = readFileSync(join(SECTIONS, "section-nav.tsx"), "utf8");
    expect(nav).toContain("sticky top-20");
    expect(nav).toContain("lg:self-start");
    expect(nav).toContain("ABOUT_SECTIONS.map");
    // The wrapper is a grid only from `lg`. A sticky grid item moves only
    // within its own cell, so a one-column grid below `lg` pinned the strip to
    // its own height and it scrolled away with the page.
    expect(codeOnly(hub)).toContain(
      'className="lg:grid lg:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] lg:gap-16"'
    );
    expect(codeOnly(hub)).not.toContain('className="grid grid-cols-1');
  });

  it.each(
    readdirSync(SECTIONS).filter((name) => name.endsWith(".tsx"))
  )("section %s renders on the server, without scroll motion", (file) => {
    const source = readFileSync(join(SECTIONS, file), "utf8");
    expect(source).not.toContain('"use client"');
    expect(source).not.toContain("motion/react");
    expect(source).not.toContain("whileInView");
    expect(source).not.toContain("@repo/ui/components/ui/card");
  });
});

describe("the subtree's shape", () => {
  it("lists every about directory, so a new one cannot be missed", () => {
    const dirs = readdirSync(ABOUT, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    expect(dirs).toEqual([...PAGES, ...RETIRED].sort());
  });

  it("has deleted the metadata-only layouts", () => {
    // They existed only because a Client Component cannot export metadata.
    // Every page owns its own `generateMetadata` now, so an empty layout that
    // returns `children` is a wrapper with nothing to do.
    for (const layout of [
      "src/app/(public)/about/layout.tsx",
      "src/app/(public)/about/drugs-policy/layout.tsx",
      "src/app/(public)/resources/layout.tsx",
      "src/app/(public)/safety/layout.tsx",
    ]) {
      expect(existsSync(join(root, layout)), layout).toBe(false);
    }
  });

  it.each([
    ["src/app/(public)/about/page.tsx", "about"],
    ["src/app/(public)/resources/page.tsx", "resources"],
    ["src/app/(public)/safety/page.tsx", "varsling"],
  ])("%s is a Server Component that owns its metadata", (path) => {
    const source = readFileSync(join(root, path), "utf8");
    expect(source).not.toContain('"use client"');
    expect(source).toContain("export async function generateMetadata");
    expect(source).toContain("<PageHeader");
    expect(source).not.toContain("whileInView");
  });
});
