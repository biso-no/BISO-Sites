import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { codeOnly } from "@/test/source";

const read = (f: string) =>
  codeOnly(readFileSync(join(import.meta.dirname, f), "utf8"));

const robots = read("robots.ts");
const sitemap = read("sitemap.ts");

const ALIASES = [
  { from: "(public)/varsling", to: "/safety" },
  { from: "(public)/shop/membership", to: "/membership/join" },
];

describe("crawler surface (RD-033)", () => {
  it("keeps /design-system out of the index", () => {
    // The reference page is an internal artefact: it renders every token and
    // type role, so a crawler indexing it would surface swatch labels as BISO
    // content. RD-007 excluded it; nothing failed if that was undone.
    expect(robots).toContain('"/design-system"');
    expect(sitemap).not.toContain("design-system");
  });

  it("serves the legacy aliases as 308 route handlers, not pages", () => {
    // A page calling `permanentRedirect()` cannot set the status under
    // `cacheComponents` — PPR flushes the shell with a 200 first, so the
    // redirect degrades to a client-side hop and no link equity passes.
    // RD-034 moved both to route handlers; a page file at either path would
    // shadow the handler and silently reinstate the 200.
    for (const alias of ALIASES) {
      const handler = join(import.meta.dirname, alias.from, "route.ts");
      expect(existsSync(handler), `${alias.from}/route.ts`).toBe(true);
      expect(
        existsSync(join(import.meta.dirname, alias.from, "page.tsx"))
      ).toBe(false);
      const source = codeOnly(readFileSync(handler, "utf8"));
      expect(source).toContain(`"${alias.to}"`);
      expect(source).toContain("308");
    }
  });
});
