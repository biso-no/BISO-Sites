import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveHref } from "./content-files";
import { matchRedirect, type RedirectRule } from "./redirects";

const root = join(import.meta.dir, "..");
const rules: RedirectRule[] = JSON.parse(
  readFileSync(join(root, "redirects.json"), "utf8")
);
const legacyUrls: string[] = JSON.parse(
  readFileSync(join(root, "legacy-urls.json"), "utf8")
);

test("every old URL is redirected", () => {
  for (const url of legacyUrls) {
    expect(matchRedirect(url, rules), url).not.toBeNull();
  }
});

test("every destination is a live page", () => {
  for (const r of rules) {
    expect(resolveHref(r.destination), r.destination).not.toBeNull();
  }
});

test("no chains or loops", () => {
  for (const r of rules) {
    expect(matchRedirect(r.destination, rules), r.destination).toBeNull();
  }
});

test("deep path and trailing slash", () => {
  expect(
    matchRedirect("/docs/admin-handbook/jobs/creating-vacancies/", rules)
  ).toBe("/guide");
});

test("section root without a sub-path", () => {
  expect(matchRedirect("/docs/handover", rules)).toBe("/developers");
});

test("first match wins", () => {
  expect(
    matchRedirect("/docs/a/b", [
      { source: "/docs/a/b", destination: "/x" },
      { source: "/docs/a/:path*", destination: "/y" },
    ])
  ).toBe("/x");
});
