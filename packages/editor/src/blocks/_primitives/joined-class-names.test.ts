import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * `pe-variant${on ? "on" : ""}` yields "pe-varianton": a class nobody styles.
 * A formatting pass once dropped the leading space from these templates and
 * every variant picker, the active tab and the big gallery tile lost their
 * state styling. Any interpolation must be preceded by whitespace.
 */
const SRC_DIR = join(import.meta.dir, "../..");
const CLASS_TEMPLATE = /className=\{`((?:\\[\s\S]|[^`\\])*)`\}/g;
// A letter or digit right before `${`. A hyphen before it is the BEM
// modifier form (`pg-hero--${variant}`), which is fine.
const GLUED_INTERPOLATION = /[A-Za-z0-9_]\$\{/;

function tsxFiles(directory: string): string[] {
  const paths: string[] = [];
  for (const entry of readdirSync(directory)) {
    const fullPath = join(directory, entry);
    if (statSync(fullPath).isDirectory()) {
      paths.push(...tsxFiles(fullPath));
    } else if (entry.endsWith(".tsx") && !entry.endsWith(".test.tsx")) {
      paths.push(fullPath);
    }
  }
  return paths;
}

describe("class name templates", () => {
  test("never glue an interpolation onto the class before it", () => {
    const offenders = tsxFiles(SRC_DIR).flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(CLASS_TEMPLATE)]
        .map(([, template]) => template)
        .filter((template) => GLUED_INTERPOLATION.test(template))
        .map((template) => `${file.replace(SRC_DIR, "src")}: \`${template}\``)
    );

    expect(offenders).toEqual([]);
  });
});
