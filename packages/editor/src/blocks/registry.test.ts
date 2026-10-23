import { expect, test } from "bun:test";
import { BLOCK_TYPES } from "@/ai/tools";
import { allBlocks, paletteGroups } from "./index";

const HIDDEN: string[] = [
  "profileHeader",
  "filterBar",
  "campusSelector",
  "twoCol",
];

test("paletteGroups() never offers a hidden type", () => {
  const offered = paletteGroups().flatMap((g) => g.items.map((i) => i.type));
  for (const type of HIDDEN) {
    expect(offered).not.toContain(type);
  }
  for (const def of allBlocks().filter((d) => d.hidden)) {
    expect(offered).not.toContain(def.type);
  }
});

test("the four cut blocks are registered but hidden", () => {
  const hidden: string[] = allBlocks()
    .filter((d) => d.hidden)
    .map((d) => d.type)
    .sort();
  expect(hidden).toEqual([...HIDDEN].sort());
});

test("every non-hidden type is in exactly one group", () => {
  const offered = paletteGroups().flatMap((g) => g.items.map((i) => i.type));
  const expected = allBlocks()
    .filter((d) => !d.hidden)
    .map((d) => d.type);
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

test("BLOCK_TYPES equals the set of non-hidden registered types", () => {
  const expected = allBlocks()
    .filter((d) => !d.hidden)
    .map((d) => d.type);
  expect([...BLOCK_TYPES].sort()).toEqual([...expected].sort());
});
