import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { BLOCK_TYPES, blockTypesOf } from "./index";

const BLOCKS_DIR = join(import.meta.dir, "../../blocks");
const LEADING_COMMENTS = /^(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*/;
const USE_CLIENT = /^["']use client["']/;

test("no block registration file is a client module", () => {
  // A "use client" index.tsx reaches the server AI route as a client
  // reference, so its registerBlock() never runs there and the block
  // silently drops out of BLOCK_TYPES.
  const offenders: string[] = [];
  for (const entry of readdirSync(BLOCKS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    let source: string;
    try {
      source = readFileSync(join(BLOCKS_DIR, entry.name, "index.tsx"), "utf8");
    } catch {
      continue;
    }
    if (USE_CLIENT.test(source.replace(LEADING_COMMENTS, ""))) {
      offenders.push(`${entry.name}/index.tsx`);
    }
  }
  expect(offenders).toEqual([]);
});

test("BLOCK_TYPES is never empty", () => {
  expect(BLOCK_TYPES.length).toBeGreaterThan(0);
});

test("an empty registry throws instead of yielding an empty enum", () => {
  expect(() => blockTypesOf([])).toThrow("No block types are registered");
  expect(() =>
    blockTypesOf([{ group: "text", items: [], label: "Text" }])
  ).toThrow("No block types are registered");
});

test("block types keep palette order", () => {
  expect(
    blockTypesOf([
      {
        group: "text",
        label: "Text",
        items: [
          { type: "heading", label: "Heading", desc: "" },
          { type: "text", label: "Text", desc: "" },
        ],
      },
      {
        group: "media",
        label: "Media",
        items: [{ type: "image", label: "Image", desc: "" }],
      },
    ])
  ).toEqual(["heading", "text", "image"]);
});
