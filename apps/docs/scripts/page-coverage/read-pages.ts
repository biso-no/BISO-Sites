import { readFileSync } from "node:fs";
import { Glob, YAML } from "bun";
import type { PageCoverage } from "./check";

const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---/;
const PAGES_DIR = "apps/docs/content/docs";

export function readPages(repoRoot: string): PageCoverage[] {
  const glob = new Glob("**/*.mdx");
  const cwd = `${repoRoot}/${PAGES_DIR}`;
  const pages: PageCoverage[] = [];
  for (const rel of glob.scanSync({ cwd })) {
    const text = readFileSync(`${cwd}/${rel}`, "utf8");
    const match = FRONT_MATTER.exec(text);
    const page = `${PAGES_DIR}/${rel}`;
    let data: unknown = null;
    try {
      data = match ? (YAML.parse(match[1]) as unknown) : null;
    } catch {
      pages.push({ page, covers: null, malformed: true });
      continue;
    }
    const covers =
      data && typeof data === "object" && "covers" in data
        ? (data as { covers: unknown }).covers
        : undefined;
    if (covers === undefined) {
      pages.push({ page, covers: null });
    } else if (
      Array.isArray(covers) &&
      covers.every((c) => typeof c === "string")
    ) {
      pages.push({ page, covers });
    } else {
      pages.push({ page, covers: null, malformed: true });
    }
  }
  return pages;
}
