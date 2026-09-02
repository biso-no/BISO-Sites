import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { codeOnly } from "@/test/source";

const root = process.cwd();
const MESSAGES = join(root, "../../packages/i18n/messages");
const LOCALES = ["no", "en"] as const;

function flatten(
  value: unknown,
  prefix = "",
  out: Record<string, string> = {}
): Record<string, string> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      flatten(child, prefix ? `${prefix}.${key}` : key, out);
    }
  } else {
    out[prefix] = String(value);
  }
  return out;
}

function allKeys(locale: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const file of readdirSync(join(MESSAGES, locale))) {
    if (!file.endsWith(".json")) {
      continue;
    }
    const parsed = JSON.parse(
      readFileSync(join(MESSAGES, locale, file), "utf8")
    );
    for (const [key, value] of Object.entries(flatten(parsed))) {
      out[`${file.slice(0, -5)}.${key}`] = value;
    }
  }
  return out;
}

/**
 * RD-032 — the locale sweep.
 *
 * The browser half (no raw key rendered, no Norwegian overflow at 320px,
 * `<html lang>` correct, æøå in every display role) is in STATUS.md; source
 * cannot prove any of it. What is checkable here is the shape of the bundles
 * and the absence of the hardcoded strings this package removed.
 */
describe("message bundles", () => {
  const no = allKeys("no");
  const en = allKeys("en");

  it("has the same namespace files in both locales", () => {
    const noFiles = readdirSync(join(MESSAGES, "no")).sort();
    const enFiles = readdirSync(join(MESSAGES, "en")).sort();
    expect(noFiles).toEqual(enFiles);
  });

  it("has exact key parity", () => {
    const onlyNo = Object.keys(no).filter((k) => !(k in en));
    const onlyEn = Object.keys(en).filter((k) => !(k in no));
    expect({ onlyEn, onlyNo }).toEqual({ onlyEn: [], onlyNo: [] });
  });

  it.each(LOCALES)("%s has no empty string except the documented one", (l) => {
    const keys = l === "no" ? no : en;
    const empty = Object.entries(keys)
      .filter(([, v]) => !v.trim())
      .map(([k]) => k);
    // `terms.sections.contact.highlight` is deliberately "": the terms page
    // draws a callout only when the highlight is non-empty.
    expect(empty).toEqual(["terms.sections.contact.highlight"]);
  });

  it.each(LOCALES)("%s loads every namespace file", (locale) => {
    // What makes a namespace reachable is the barrel in `messages/<locale>.ts`
    // — `loadMessages` returns its default export. **Not** `messageNamespaces`,
    // which RD-032 found is exported from `@repo/i18n` and imported by nothing,
    // and is missing six namespaces including `events`, `jobs` and `news`.
    const barrel = readFileSync(join(MESSAGES, `${locale}.ts`), "utf8");
    for (const file of readdirSync(join(MESSAGES, locale))) {
      if (!file.endsWith(".json")) {
        continue;
      }
      const ns = file.slice(0, -5);
      expect(barrel, `${ns} import`).toContain(`./${locale}/${ns}.json`);
      expect(barrel, `${ns} export`).toMatch(
        new RegExp(`^\\s*${ns},\\s*$`, "m")
      );
    }
  });
});

describe("strings this package moved into the bundles", () => {
  const read = (rel: string) => readFileSync(join(root, "src", rel), "utf8");

  it.each([
    ["components/shop/use-product-actions.ts", "Added to cart"],
    ["app/(protected)/applications/page.tsx", "No applications yet"],
    ["app/(protected)/fs/page.tsx", "No reimbursements yet"],
    ["components/expense/v2/expense-status.ts", "Posting failed"],
    [
      "app/(public)/units/[...segments]/components/team-tab.tsx",
      "Meet Our Team",
    ],
    ["components/jobs/job-application-form.tsx", "Sign in to apply"],
    ["components/privacy-controls.tsx", "Your Privacy Rights"],
    ["components/select-campus.tsx", "Vis alt innhold"],
  ])("%s no longer hardcodes %s", (file, literal) => {
    // `codeOnly`: several of these files carry a comment naming the string
    // they replaced. Seventh time this trap has caught an assertion.
    expect(codeOnly(read(file))).not.toContain(literal);
  });

  it("keeps the document categories as keys, not labels", () => {
    const source = read("components/documents/v2/document-categories.ts");
    expect(source).toContain("DOCUMENT_CATEGORIES");
    expect(source).not.toContain("National Statutes");
  });
});
