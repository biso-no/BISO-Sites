import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const MAX_DURATION = /^export const maxDuration = 300;$/m;

// Ruling R14: "Send now" and "Try again" send inside the action under this
// page, so it gets as long as the other big event pages.
test("the Messages page may run for five minutes", () => {
  const page = readFileSync(join(import.meta.dir, "page.tsx"), "utf8");
  expect(page).toMatch(MAX_DURATION);
});
