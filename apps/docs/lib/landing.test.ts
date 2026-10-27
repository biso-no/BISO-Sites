import { expect, test } from "bun:test";
import { resolveHref } from "./content-files";
import { readingPaths, taskGroups } from "./landing";

test("every landing link resolves to a page", () => {
  const hrefs = [
    ...readingPaths.flatMap((p) => p.steps),
    ...taskGroups.flatMap((g) => [g, ...g.tasks]),
  ].map((l) => l.href);
  for (const href of hrefs) {
    expect(resolveHref(href), href).not.toBeNull();
  }
});
