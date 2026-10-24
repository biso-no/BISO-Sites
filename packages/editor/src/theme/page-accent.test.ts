import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const readThemeFile = (name: string): string =>
  readFileSync(join(import.meta.dir, name), "utf8");

test("editor chrome consumes the dedicated page accent", () => {
  const tokens = readThemeFile("tokens.css");
  const editor = readThemeFile("editor.css");

  expect(tokens).toContain("--page-accent:");
  expect(editor).toContain("var(--page-accent");
  expect(editor).not.toContain("var(--accent");
});
