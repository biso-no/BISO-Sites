import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const readThemeFile = (name: string): string =>
  readFileSync(join(import.meta.dir, name), "utf8");

test("legacy blocks and editor chrome consume the dedicated page accent", () => {
  const tokens = readThemeFile("tokens.css");
  const blocks = readThemeFile("blocks.css");
  const editor = readThemeFile("editor.css");

  expect(tokens).toContain("--page-accent:");
  expect(blocks).toContain("var(--page-accent");
  expect(editor).toContain("var(--page-accent");
  expect(blocks).not.toContain("var(--accent");
  expect(editor).not.toContain("var(--accent");
});
