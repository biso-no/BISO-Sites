import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PRIVATE_VALUES } from "./registry";

/**
 * Stage 3b flips this to `true` once the handover pages exist, so that every
 * non-kit registry entry must be used by at least one page.
 */
export const REQUIRE_REGISTRY_USAGE = false;

const CONTENT = join(import.meta.dir, "../../content");
const USAGE = /<Private\s+name="([^"]+)"/g;

function mdxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return mdxFiles(path);
    }
    return entry.name.endsWith(".mdx") ? [path] : [];
  });
}

function usedNames(): Set<string> {
  const used = new Set<string>();
  for (const file of mdxFiles(CONTENT)) {
    for (const match of readFileSync(file, "utf8").matchAll(USAGE)) {
      used.add(match[1] as string);
    }
  }
  return used;
}

describe("private registry", () => {
  it("knows every name used in an MDX page", () => {
    for (const name of usedNames()) {
      expect(Object.hasOwn(PRIVATE_VALUES, name)).toBe(true);
    }
  });

  it("is used by pages for every non-kit entry (once required)", () => {
    if (!REQUIRE_REGISTRY_USAGE) {
      return;
    }
    const used = usedNames();
    for (const [name, entry] of Object.entries(PRIVATE_VALUES)) {
      if (!("kitOnly" in entry)) {
        expect(used.has(name)).toBe(true);
      }
    }
  });

  it("marks only the emergency kit as kit-only, with a description each", () => {
    for (const [name, entry] of Object.entries(PRIVATE_VALUES)) {
      expect(entry.description.length).toBeGreaterThan(10);
      expect("kitOnly" in entry).toBe(name === "emergency-kit-contents");
    }
  });
});
