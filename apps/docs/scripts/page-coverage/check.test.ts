import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  findDeadGlobs,
  findMissingCoverage,
  findStalePages,
  findUnlistedNarrative,
} from "./check";
import { readPages } from "./read-pages";

const pages = [
  {
    page: "apps/docs/content/docs/guide/recruitment/index.mdx",
    covers: [
      "apps/admin/src/app/(admin)/jobs/[id]/**",
      "packages/shared/recruitment/**",
    ],
  },
  { page: "apps/docs/content/docs/developers/history.mdx", covers: [] },
  { page: "apps/docs/content/docs/guide/new.mdx", covers: null },
];

test("route folders match literally", () =>
  expect(
    findStalePages(pages, ["apps/admin/src/app/(admin)/jobs/[id]/page.tsx"])
  ).toEqual([
    {
      page: pages[0].page,
      files: ["apps/admin/src/app/(admin)/jobs/[id]/page.tsx"],
    },
  ]));

test("no warning when the page changed too", () =>
  expect(
    findStalePages(pages, [
      "packages/shared/recruitment/apply.ts",
      pages[0].page,
    ])
  ).toEqual([]));

test("unrelated change", () =>
  expect(findStalePages(pages, ["apps/web/src/app/page.tsx"])).toEqual([]));

test("dead glob", () =>
  expect(
    findDeadGlobs(pages, ["packages/shared/recruitment/apply.ts"])
  ).toEqual([
    { page: pages[0].page, glob: "apps/admin/src/app/(admin)/jobs/[id]/**" },
  ]));

test("missing covers only for changed pages", () => {
  expect(findMissingCoverage(pages, [])).toEqual([]);
  expect(findMissingCoverage(pages, [pages[2].page])).toEqual([pages[2].page]);
});

test("narrative page is fine", () =>
  expect(findMissingCoverage(pages, [pages[1].page])).toEqual([]));

test("readPages reads covers from front matter", () => {
  const root = mkdtempSync(join(tmpdir(), "docs-coverage-"));
  try {
    const dir = join(root, "apps/docs/content/docs/guide");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "a.mdx"),
      '---\ntitle: A\ncovers:\n  - "packages/shared/**"\n---\n\nBody\n'
    );
    writeFileSync(join(dir, "b.mdx"), "---\ntitle: B\n---\n\nBody\n");
    const result = readPages(root).sort((x, y) => x.page.localeCompare(y.page));
    expect(result).toEqual([
      {
        page: "apps/docs/content/docs/guide/a.mdx",
        covers: ["packages/shared/**"],
      },
      { page: "apps/docs/content/docs/guide/b.mdx", covers: null },
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("readPages flags a malformed covers value", () => {
  const root = mkdtempSync(join(tmpdir(), "docs-coverage-"));
  try {
    const dir = join(root, "apps/docs/content/docs");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "c.mdx"), "---\ntitle: C\ncovers: nope\n---\n");
    expect(readPages(root)).toEqual([
      { page: "apps/docs/content/docs/c.mdx", covers: null, malformed: true },
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("malformed pages are not also reported as missing coverage", () =>
  expect(
    findMissingCoverage(
      [{ page: "a.mdx", covers: null, malformed: true }],
      ["a.mdx"]
    )
  ).toEqual([]));

test("a YAML alias in covers does not abort the run", () => {
  const root = mkdtempSync(join(tmpdir(), "covers-"));
  try {
    const dir = join(root, "apps/docs/content/docs");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "bad.mdx"),
      "---\ntitle: x\ncovers:\n  - **/jobs/**\n---\n"
    );
    writeFileSync(join(dir, "ok.mdx"), "---\ntitle: x\ncovers: []\n---\n");
    const result = readPages(root);
    expect(result.find((p) => p.page.endsWith("bad.mdx"))).toEqual({
      page: "apps/docs/content/docs/bad.mdx",
      covers: null,
      malformed: true,
    });
    expect(result.find((p) => p.page.endsWith("ok.mdx"))?.covers).toEqual([]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

const narrative = [
  { page: "listed.mdx", covers: [] },
  { page: "unlisted.mdx", covers: [] },
  { page: "code.mdx", covers: ["a/**"] },
];

test("listed narrative page gets no warning", () =>
  expect(
    findUnlistedNarrative(narrative, ["listed.mdx"], ["listed.mdx"])
  ).toEqual([]));

test("unlisted covers: [] page that changed gets a warning", () =>
  expect(
    findUnlistedNarrative(
      narrative,
      ["unlisted.mdx", "code.mdx"],
      ["listed.mdx"]
    )
  ).toEqual(["unlisted.mdx"]));

test("unchanged unlisted narrative page gets no warning", () =>
  expect(findUnlistedNarrative(narrative, [], [])).toEqual([]));
