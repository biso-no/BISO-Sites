import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PRIVATE_VALUES } from "./registry";
import { scanPrivateUsages } from "./scan";

/**
 * Stage 3b flips this to `true` once the handover pages exist, so that every
 * non-kit registry entry must be used by at least one page.
 */
export const REQUIRE_REGISTRY_USAGE = false;

const CONTENT = join(import.meta.dir, "../../content");

function mdxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return mdxFiles(path);
    }
    return entry.name.endsWith(".mdx") ? [path] : [];
  });
}

function scanContent() {
  const names = new Set<string>();
  const unnamed: string[] = [];
  for (const file of mdxFiles(CONTENT)) {
    const found = scanPrivateUsages(readFileSync(file, "utf8"));
    for (const name of found.names) {
      names.add(name);
    }
    unnamed.push(...found.unnamed.map((tag) => `${file}: ${tag}`));
  }
  return { names, unnamed };
}

describe("scanPrivateUsages", () => {
  it("finds label-first, single-quoted and multi-line tags", () => {
    const found = scanPrivateUsages(
      [
        '<Private name="a" />',
        '<Private label="X" name="b" />',
        "<Private name='c' />",
        '<Private\n  label="Y"\n  name="d"\n/>',
      ].join("\n")
    );
    expect(found.names).toEqual(["a", "b", "c", "d"]);
    expect(found.unnamed).toEqual([]);
  });

  it("reports tags with no literal name", () => {
    const found = scanPrivateUsages(
      '<Private label="X" />\n<Private name={n} />'
    );
    expect(found.names).toEqual([]);
    expect(found.unnamed.length).toBe(2);
  });

  it("does not match other components", () => {
    expect(scanPrivateUsages('<PrivateThing name="a" />').names).toEqual([]);
  });

  it("leaves unknown names for the registry check to reject", () => {
    const found = scanPrivateUsages('<Private name="nope" />');
    expect(Object.hasOwn(PRIVATE_VALUES, found.names[0] as string)).toBe(false);
  });
});

describe("private registry", () => {
  it("knows every name used in an MDX page, and every tag has a name", () => {
    const { names, unnamed } = scanContent();
    expect(unnamed).toEqual([]);
    for (const name of names) {
      expect(Object.hasOwn(PRIVATE_VALUES, name)).toBe(true);
    }
  });

  it.if(REQUIRE_REGISTRY_USAGE)(
    "is used by pages for every non-kit entry",
    () => {
      const { names } = scanContent();
      for (const [name, entry] of Object.entries(PRIVATE_VALUES)) {
        if (!("kitOnly" in entry && entry.kitOnly === true)) {
          expect(names.has(name)).toBe(true);
        }
      }
    }
  );

  it("gives every entry a description", () => {
    for (const entry of Object.values(PRIVATE_VALUES)) {
      expect(entry.description.length).toBeGreaterThan(10);
    }
  });
});
