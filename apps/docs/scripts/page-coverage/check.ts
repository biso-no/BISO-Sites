import { Glob } from "bun";
export interface PageCoverage {
  covers: string[] | null;
  /** `covers` is present but not a list of strings. */
  malformed?: boolean;
  page: string;
}

const BRACKET = /[[\]]/g;

/** Build a glob where `[` and `]` match literally (Next route folders). */
export function toGlob(pattern: string): Glob {
  return new Glob(pattern.replace(BRACKET, (c) => `\\${c}`));
}

export function findStalePages(
  pages: PageCoverage[],
  changed: string[]
): { page: string; files: string[] }[] {
  const changedSet = new Set(changed);
  const result: { page: string; files: string[] }[] = [];
  for (const { page, covers } of pages) {
    if (!covers || covers.length === 0 || changedSet.has(page)) {
      continue;
    }
    const globs = covers.map(toGlob);
    const files = changed.filter((file) => globs.some((g) => g.match(file)));
    if (files.length > 0) {
      result.push({ page, files });
    }
  }
  return result;
}

export function findDeadGlobs(
  pages: PageCoverage[],
  repoFiles: string[]
): { page: string; glob: string }[] {
  const result: { page: string; glob: string }[] = [];
  for (const { page, covers } of pages) {
    for (const glob of covers ?? []) {
      const matcher = toGlob(glob);
      if (!repoFiles.some((file) => matcher.match(file))) {
        result.push({ page, glob });
      }
    }
  }
  return result;
}

export function findMissingCoverage(
  pages: PageCoverage[],
  changed: string[]
): string[] {
  const changedSet = new Set(changed);
  return pages
    .filter(({ page, covers }) => covers === null && changedSet.has(page))
    .map(({ page }) => page);
}

export function findMalformed(pages: PageCoverage[]): string[] {
  return pages.filter((p) => p.malformed).map((p) => p.page);
}
