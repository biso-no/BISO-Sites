import { expect, test } from "bun:test";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { BLOCK_TYPES } from "@/ai/tools";
import { allBlocks, paletteGroups } from "./index";

const CUT_BLOCKS = ["profileHeader", "filterBar", "campusSelector", "twoCol"];

/** Every block folder: the underscore folders hold shared pieces, not blocks. */
const blockFolders = (): string[] =>
  readdirSync(import.meta.dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
    .map((entry) => entry.name);

test("the four cut blocks are gone: no folder, no registration", () => {
  const registered: string[] = allBlocks().map((d) => d.type);
  for (const type of CUT_BLOCKS) {
    expect(existsSync(join(import.meta.dir, type)), type).toBe(false);
    expect(registered).not.toContain(type);
  }
});

test("every block folder registers exactly one block of the same name", () => {
  const registered = allBlocks()
    .map((d) => d.type as string)
    .sort();
  expect(registered).toEqual([...blockFolders()].sort());
});

test("no definition carries the retired v2 or hidden flags", () => {
  for (const def of allBlocks()) {
    expect("v2" in def, `${def.type} v2`).toBe(false);
    expect("hidden" in def, `${def.type} hidden`).toBe(false);
  }
});

test("every registered type is in exactly one group", () => {
  const offered = paletteGroups().flatMap((g) => g.items.map((i) => i.type));
  const expected = allBlocks().map((d) => d.type);
  expect([...offered].sort()).toEqual([...expected].sort());
  expect(new Set(offered).size).toBe(offered.length);
});

test("groups come in the agreed order and none is empty", () => {
  expect(paletteGroups().map((g) => g.label)).toEqual([
    "Text and story",
    "Media",
    "Structure",
    "People",
    "Live from BISO",
    "Actions",
    "Small extras",
  ]);
  for (const g of paletteGroups()) {
    expect(g.items.length).toBeGreaterThan(0);
  }
});

test("BLOCK_TYPES equals the set of registered types", () => {
  const expected = allBlocks().map((d) => d.type);
  expect([...BLOCK_TYPES].sort()).toEqual([...expected].sort());
});
