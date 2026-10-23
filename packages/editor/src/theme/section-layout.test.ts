import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const BLOCKS_DIR = join(import.meta.dir, "..", "blocks");
const ROOT_CLASS =
  /className=(?:"pg-([a-z-]+)[^"]*\bpg-block\b|\{`pg-([a-z-]+)[^`]*\bpg-block\b)/g;
const TS_SOURCE = /\.tsx?$/;
const TEST_SOURCE = /\.test\.tsx?$/;
const LEGACY_FRAME = /\bpg-section\b|\bpg-block\b/;
const INLINE_COLOUR = /\bcolor:\s*"(#[0-9a-fA-F]{3,8}|rgba?\([^"]*\))"/g;

/**
 * Inline colours that sit on a surface of their own, so they cannot meet the
 * section background: the gallery's remove button is a dark chip, and its
 * upload error only shows in the editor.
 */
const SELF_CONTAINED_INLINE_COLOURS = new Set([
  "gallery/render.tsx #fff",
  "gallery/render.tsx #b42318",
]);

const sourceFiles = (directory: string, wanted: (name: string) => boolean) =>
  readdirSync(directory).flatMap((entry): string[] => {
    const fullPath = join(directory, entry);
    if (statSync(fullPath).isDirectory()) {
      return sourceFiles(fullPath, wanted);
    }
    return wanted(entry) ? [fullPath] : [];
  });

const renderFiles = (directory: string): string[] =>
  sourceFiles(directory, (name) => name === "render.tsx");

const nonTestSources = (directory: string): string[] =>
  sourceFiles(
    directory,
    (name) => TS_SOURCE.test(name) && !TEST_SOURCE.test(name)
  );

/** `hero`, `text`, … — the class a block would put on a legacy-framed root. */
const rootClasses = new Set(
  renderFiles(BLOCKS_DIR).flatMap((file) =>
    [...readFileSync(file, "utf8").matchAll(ROOT_CLASS)].map(
      ([, quoted, templated]) => quoted ?? templated
    )
  )
);

describe("no legacy block styling is left", () => {
  test("no legacy roots exist: no block puts a pg-<name> pg-block class on its root", () => {
    expect([...rootClasses]).toEqual([]);
  });

  test("blocks.css does not exist", () => {
    expect(existsSync(join(import.meta.dir, "blocks.css"))).toBe(false);
  });

  test("no block or editor source names the legacy frame", () => {
    const offenders = nonTestSources(join(import.meta.dir, "..")).filter(
      (file) => LEGACY_FRAME.test(readFileSync(file, "utf8"))
    );
    expect(offenders).toEqual([]);
  });
});

describe("block renderers leave colour to the surface", () => {
  test("no renderer hardcodes an inline colour that a surface cannot follow", () => {
    const hardcoded: string[] = [];
    for (const file of renderFiles(BLOCKS_DIR)) {
      const name = file.slice(BLOCKS_DIR.length + 1);
      for (const [, colour] of readFileSync(file, "utf8").matchAll(
        INLINE_COLOUR
      )) {
        if (!SELF_CONTAINED_INLINE_COLOURS.has(`${name} ${colour}`)) {
          hardcoded.push(`${name} ${colour}`);
        }
      }
    }
    expect(hardcoded).toEqual([]);
  });
});
