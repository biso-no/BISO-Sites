import { readFileSync } from "node:fs";
import type { PageCoverage } from "./check";

const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---/;
const PAGES_DIR = "apps/docs/content/docs";

export function readPages(repoRoot: string): PageCoverage[] {
  const glob = new Bun.Glob("**/*.mdx");
  const cwd = `${repoRoot}/${PAGES_DIR}`;
  const pages: PageCoverage[] = [];
  for (const rel of glob.scanSync({ cwd })) {
    const text = readFileSync(`${cwd}/${rel}`, "utf8");
    const match = FRONT_MATTER.exec(text);
    const data = match ? (Bun.YAML.parse(match[1]) as unknown) : null;
    const covers =
      data && typeof data === "object" && "covers" in data
        ? (data as { covers: unknown }).covers
        : undefined;
    pages.push({
      page: `${PAGES_DIR}/${rel}`,
      covers: Array.isArray(covers) ? covers.map(String) : null,
    });
  }
  return pages;
}
