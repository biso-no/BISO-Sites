import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const TEST_FILE_RE = /\.test\.tsx$/;
const SRC = join(import.meta.dir, "..", "..");
const BLOCKS = join(SRC, "blocks");

interface Rule {
  /** Skip files under these directories. */
  exceptDirs?: string[];
  name: string;
  test: RegExp;
}

const RULES: Rule[] = [
  { name: "viewport variant", test: /(^|\s|")(sm|md|lg|xl|2xl):/ },
  { name: "hex colour", test: /#[0-9a-fA-F]{3,8}\b/ },
  { name: "white/black text", test: /text-white|bg-white|text-black/ },
  {
    name: "palette colour",
    test: /-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/,
  },
  {
    name: "legacy token",
    test: /bg-brand|bg-section|bg-inverted|bg-primary|text-foreground|bg-muted|bg-card|text-muted-foreground/,
  },
  { name: "font-medium", test: /font-medium/ },
  { name: "gradient", test: /gradient/ },
  { name: "backdrop-blur", test: /backdrop-blur/ },
  { name: "whileInView", test: /whileInView/ },
  { name: "hover lift", test: /hover:-translate/ },
  { name: "non-elev shadow", test: /shadow-(?!elev-)/ },
  { name: "non-biso radius", test: /rounded-(?!biso-|none)/ },
  { name: "next/link", test: /next\/link/ },
  { name: "h1 in a block", test: /<h1/, exceptDirs: ["header"] },
];

const violations = (source: string, dir = ""): string[] =>
  RULES.filter(
    (rule) => !rule.exceptDirs?.includes(dir) && rule.test.test(source)
  ).map((rule) => rule.name);

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

const isScanned = (file: string) =>
  file.endsWith(".tsx") && !TEST_FILE_RE.test(file);

/** [dir label, file] for every file the design rules bind. */
const scanTargets = (): [string, string][] => {
  const targets: [string, string][] = [];
  const v2Dirs: [string, string][] = [["_v2", join(BLOCKS, "_v2")]];
  for (const entry of readdirSync(BLOCKS)) {
    const index = join(BLOCKS, entry, "index.tsx");
    if (
      !entry.startsWith("_") &&
      existsSync(index) &&
      readFileSync(index, "utf8").includes("v2: true")
    ) {
      v2Dirs.push([entry, join(BLOCKS, entry)]);
    }
  }
  const header = join(SRC, "header");
  if (existsSync(header)) {
    v2Dirs.push(["header", header]);
  }
  for (const [label, dir] of v2Dirs) {
    for (const file of walk(dir).filter(isScanned)) {
      targets.push([label, file]);
    }
  }
  return targets;
};

describe("v2 design rules", () => {
  test("every v2 block, _v2 and header file follows them", () => {
    const found: string[] = [];
    for (const [label, file] of scanTargets()) {
      const hits = violations(readFileSync(file, "utf8"), label);
      for (const hit of hits) {
        found.push(`${file}: ${hit}`);
      }
    }
    expect(found).toEqual([]);
  });

  const PLANTED: Record<string, string> = {
    "viewport variant": '<div className="flex md:grid" />',
    "hex colour": 'style={{ color: "#fff" }}',
    "white/black text": '<p className="text-white" />',
    "palette colour": '<p className="bg-blue-500" />',
    "legacy token": '<p className="bg-brand" />',
    "font-medium": '<p className="font-medium" />',
    gradient: '<p className="bg-gradient-to-r" />',
    "backdrop-blur": '<p className="backdrop-blur-md" />',
    whileInView: "<motion.div whileInView={{ opacity: 1 }} />",
    "hover lift": '<p className="hover:-translate-y-1" />',
    "non-elev shadow": '<p className="shadow-lg" />',
    "non-biso radius": '<p className="rounded-lg" />',
    "next/link": 'import Link from "next/link";',
    "h1 in a block": "<h1>Title</h1>",
  };

  test("the self-test plants every banned pattern", () => {
    expect(Object.keys(PLANTED).sort()).toEqual(
      RULES.map((rule) => rule.name).sort()
    );
  });

  for (const [name, planted] of Object.entries(PLANTED)) {
    test(`detects ${name}`, () => {
      expect(violations(planted)).toContain(name);
    });
  }

  test("allowed v2 utilities pass", () => {
    const ok =
      '<div className="@md:grid rounded-biso-md shadow-elev-1 bg-surface text-ink rounded-none font-semibold" />';
    expect(violations(ok)).toEqual([]);
  });

  test("the header may render the page's h1", () => {
    expect(violations("<h1>Title</h1>", "header")).toEqual([]);
  });
});
