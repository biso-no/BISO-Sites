import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const PUBLIC = join(root, "src/app/(public)");
const MESSAGES = join(root, "../../packages/i18n/messages");

/**
 * Message keys built from a constant list must exist in both bundles.
 *
 * Two pages shipped rendering raw key paths — `/safety` asked for
 * `cards.<key>` when the bundle has `infoCards.<key>`, and `/resources` asked
 * for `links.<key>` for its external links when those live under `external.*`.
 * Both were introduced by RD-026 normalising two different prefixes into one,
 * and neither was caught: `t()` does not throw, next-intl renders the key path,
 * and four packages of responsive sweeps only ever measured layout.
 *
 * The browser sweep now fails on any rendered word shaped like a message key,
 * which is the general net. This is the cheap unit-level check for the specific
 * shape that caused both: a literal prefix interpolated with a key from an
 * array in the same file.
 */
const CASES = [
  {
    file: "safety/page.tsx",
    namespace: "varsling",
    prefix: "infoCards",
    keys: ["harassment", "witness", "other"],
    fields: ["title", "description"],
  },
  {
    file: "resources/page.tsx",
    namespace: "resources",
    prefix: "links",
    keys: ["biFond", "studyQuality", "politics", "safety", "bylaws", "alumni"],
    fields: ["title", "description"],
  },
  {
    file: "resources/page.tsx",
    namespace: "resources",
    prefix: "external",
    keys: ["bi", "velferdstinget", "nso"],
    fields: ["title", "description"],
  },
];

function bundle(locale: string, namespace: string): Record<string, unknown> {
  return JSON.parse(
    readFileSync(join(MESSAGES, locale, `${namespace}.json`), "utf8")
  );
}

describe("message keys built from a constant list resolve", () => {
  for (const testCase of CASES) {
    const { file, namespace, prefix, keys, fields } = testCase;

    it(`${file} asks for \`${prefix}.*\` and the source agrees`, () => {
      const source = readFileSync(join(PUBLIC, file), "utf8");
      // The page must actually interpolate this prefix; otherwise the
      // assertions below would pass while the page asked for something else.
      expect(source).toContain(`${prefix}.\${key}`);
      for (const key of keys) {
        expect(source).toContain(`"${key}"`);
      }
    });

    it.each([
      "no",
      "en",
    ])(`${prefix}.* exists in %s/${namespace}.json`, (locale) => {
      const block = bundle(locale, namespace)[prefix] as Record<
        string,
        Record<string, string>
      >;
      expect(block).toBeDefined();
      for (const key of keys) {
        for (const field of fields) {
          expect(block[key]?.[field]).toBeTruthy();
        }
      }
    });
  }
});

describe("the two prefixes that were conflated stay distinct", () => {
  it("keeps resources' internal and external blocks separate", () => {
    // `links` holds the six internal destinations, `external` the three
    // outside organisations. Merging them is what broke the page.
    const no = bundle("no", "resources");
    expect(Object.keys(no.links as object)).toHaveLength(6);
    expect(Object.keys(no.external as object)).toHaveLength(3);
    expect(Object.keys(no.links as object)).not.toContain("bi");
  });

  it("keeps varsling's cards under infoCards", () => {
    const no = bundle("no", "varsling");
    expect(no.infoCards).toBeDefined();
    expect(no.cards).toBeUndefined();
  });
});
