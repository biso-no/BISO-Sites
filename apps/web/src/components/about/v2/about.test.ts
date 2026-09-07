import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const ABOUT = join(root, "src/app/(public)/about");

/**
 * RD-026 converts the about subtree from Client to Server Components. It is
 * **partly done**: the pages whose body is prose only are converted, and the
 * rest still call `useTranslations()` at render. This file pins what is
 * finished so it cannot regress, and names what is left so the count is not
 * quietly forgotten.
 */
const CONVERTED = [
  "academics-contact",
  "alumni",
  "bylaws",
  "history",
  "operations",
  "politics",
  "saih",
  "study-quality",
  "what-is-biso",
];

/** Every subpage is converted; `about/page.tsx` itself is the hub, checked below. */
const REMAINING: string[] = [];

function page(dir: string): string {
  return readFileSync(join(ABOUT, dir, "page.tsx"), "utf8");
}

describe("the converted about pages are Server Components", () => {
  it.each(CONVERTED)("%s renders on the server", (dir) => {
    const source = page(dir);
    expect(source).not.toContain('"use client"');
    expect(source).not.toContain('next-intl"');
    expect(source).toContain("next-intl/server");
    expect(source).toContain("export default async function");
  });

  it.each(CONVERTED)("%s carries its own metadata", (dir) => {
    // The subtree's metadata lives in `about/layout.tsx` only because client
    // pages cannot export it. A converted page owns its own, which is what
    // lets that layout be deleted once every page is converted.
    expect(page(dir)).toContain("export async function generateMetadata");
  });

  it.each(CONVERTED)("%s uses the design system's header", (dir) => {
    const source = page(dir);
    expect(source).toContain("<PageHeader");
    expect(source).not.toContain("AboutHero");
    expect(source).not.toContain("PublicPageHeader");
  });

  it.each(CONVERTED)("%s carries no scroll-triggered motion", (dir) => {
    // `whileInView` is the pattern the brief names as the generic default to
    // remove, and it is also what forced these pages to be client components.
    const source = page(dir);
    expect(source).not.toContain("whileInView");
    expect(source).not.toContain("motion/react");
  });
});

describe("what RD-026 still owes", () => {
  it("lists every about page, so a new one cannot be missed", () => {
    const dirs = readdirSync(ABOUT, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    expect(dirs).toEqual([...CONVERTED, ...REMAINING].sort());
  });

  it("has no page left needing the subtree layout", () => {
    const hub = readFileSync(join(ABOUT, "page.tsx"), "utf8");
    const stillClient = [
      ...REMAINING.filter((dir) => page(dir).includes('"use client"')),
      ...(hub.includes('"use client"') ? ["about/page.tsx"] : []),
    ];
    expect(stillClient).toEqual([]);
  });

  it("has deleted the three metadata-only layouts", () => {
    // They existed only because a Client Component cannot export metadata.
    // Every page owns its own `generateMetadata` now, so an empty layout that
    // returns `children` is a wrapper with nothing to do.
    for (const layout of [
      "src/app/(public)/about/layout.tsx",
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
