import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const BLOCKS_DIR = join(import.meta.dir, "..");
const INTERPOLATED_TAILWIND_CLASS = /(?:^|:)[a-z][a-z0-9-]*-\$\{/;
const TEMPLATE_LITERAL = /`(?:\\[\s\S]|[^`\\])*`/g;
const WHITESPACE = /\s+/;
const KNOWN_NON_TAILWIND_PREFIXES = [
  "msf-",
  "pe-",
  "pg-",
  "tab-body-",
  "tab-label-",
] as const;

const hasInterpolatedTailwindClass = (className: string): boolean =>
  className.split(WHITESPACE).some((token) => {
    if (
      KNOWN_NON_TAILWIND_PREFIXES.some((prefix) => token.startsWith(prefix))
    ) {
      return false;
    }
    return INTERPOLATED_TAILWIND_CLASS.test(token);
  });

const interpolatedClass = (prefix: string, variable: string): string =>
  `${prefix}-${"$"}{${variable}}`;

const findUnsafeTemplates = (source: string): string[] =>
  [...source.matchAll(TEMPLATE_LITERAL)]
    .map(([template]) => template.slice(1, -1))
    .filter(hasInterpolatedTailwindClass);

const tsxFiles = (directory: string): string[] => {
  const paths: string[] = [];
  for (const entry of readdirSync(directory)) {
    const fullPath = join(directory, entry);
    if (statSync(fullPath).isDirectory()) {
      paths.push(...tsxFiles(fullPath));
    } else if (fullPath.endsWith(".tsx")) {
      paths.push(fullPath);
    }
  }
  return paths;
};

describe("Tailwind class discovery", () => {
  test("recognizes interpolated utilities across property families and breakpoints", () => {
    const unsafe = [
      interpolatedClass("grid-cols", "columns"),
      interpolatedClass("p", "spacing"),
      interpolatedClass("bg", "tone"),
      interpolatedClass("text", "tone"),
      interpolatedClass("w", "width"),
      interpolatedClass("gap", "gap"),
      interpolatedClass("sm:grid-cols", "columns"),
    ];

    for (const candidate of unsafe) {
      expect(hasInterpolatedTailwindClass(candidate)).toBe(true);
    }
    expect(
      hasInterpolatedTailwindClass(interpolatedClass("pg-hero-", "variant"))
    ).toBe(false);
  });

  test("finds nested, conditional and referenced class templates", () => {
    const padding = interpolatedClass("p", "spacing");
    const background = interpolatedClass("bg", "tone");
    const gap = interpolatedClass("gap", "gap");
    const source = `
      const classes = \`${gap}\`;
      const nested = <div className={cn(\`${padding}\`)} />;
      const conditional = <div className={active ? \`${background}\` : "bg-muted"} />;
      const referenced = <div className={classes} />;
    `;

    expect(findUnsafeTemplates(source)).toHaveLength(3);
  });

  test("block files use complete static class names", () => {
    const offenders = tsxFiles(BLOCKS_DIR).filter(
      (filePath) =>
        findUnsafeTemplates(readFileSync(filePath, "utf8")).length > 0
    );

    expect(offenders).toEqual([]);
  });
});
