import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const MAX_DURATION = /^export const maxDuration = 300;$/m;

const read = (path: string) =>
  readFileSync(join(import.meta.dir, path), "utf8");

// Ruling R20: the Groups tab's actions (fill, publish, moves of up to 1000
// people) run under this page, so it gets as long as the participants and
// import pages.
test("the Groups page may run as long as the participants pages", () => {
  for (const page of [
    "page.tsx",
    "../participants/page.tsx",
    "../participants/import/page.tsx",
  ]) {
    expect(read(page)).toMatch(MAX_DURATION);
  }
});
