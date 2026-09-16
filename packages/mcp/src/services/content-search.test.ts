/**
 * Locale-filtered content search.
 *
 * Searching `content_translations` matches rows in either language, so the
 * locale filter has to be applied to the *matched rows* before they are
 * collapsed to parent ids. Otherwise an English search surfaces a parent whose
 * Norwegian text contains the term while its English text does not — a result
 * the caller cannot see the justification for.
 *
 * The fallback is deliberate and kept: when nothing matches in the requested
 * locale, every match is returned rather than nothing, so a search does not go
 * empty just because the term only exists in the other language.
 */

import { describe, expect, test } from "bun:test";
import {
  createFakeBackend,
  type FakeRow,
  GLOBAL_ADMIN,
} from "../testing/index";
import { createContentService } from "./content";

const LINKS = {
  web: (path: string) => `https://biso.no${path}`,
  admin: (path: string) => `https://admin.biso.no${path}`,
};

function tables() {
  return {
    news: [
      { $id: "n-both", status: "published", campus_id: "1", slug: "both" },
      {
        $id: "n-no-only",
        status: "published",
        campus_id: "1",
        slug: "no-only",
      },
    ],
    content_translations: [
      {
        $id: "t1",
        content_id: "n-both",
        content_type: "news",
        locale: "en",
        title: "Festival tickets",
        description: "",
      },
      {
        $id: "t2",
        content_id: "n-both",
        content_type: "news",
        locale: "no",
        title: "Festival billetter",
        description: "",
      },
      {
        // Only the Norwegian text carries the term.
        $id: "t3",
        content_id: "n-no-only",
        content_type: "news",
        locale: "no",
        title: "Festival stemning",
        description: "",
      },
      {
        $id: "t4",
        content_id: "n-no-only",
        content_type: "news",
        locale: "en",
        title: "Something else",
        description: "",
      },
    ],
  };
}

function service() {
  return createContentService(createFakeBackend({ tables: tables() }), LINKS);
}

const PAGE = { limit: 20, offset: 0 } as const;

const TRUNCATED_I_RE = /only the first \d+ were scanned/i;

/**
 * More translations than one scan reads, arranged so the id count stays small.
 *
 * `preferredCount` rows in the requested locale come first, then enough rows
 * in the other locale to fill the 200-row window and overflow it. The locale
 * filter therefore collapses a truncated scan down to `preferredCount` ids —
 * fewer than the 90 the `$id` batch warning triggers on, which is exactly the
 * shape where truncation would otherwise go unreported.
 */
function manyTranslations(preferredCount: number, total: number) {
  const rows: FakeRow[] = [];
  for (let i = 0; i < preferredCount; i += 1) {
    rows.push({
      $id: `t-en-${i}`,
      content_id: `n-en-${i}`,
      content_type: "news",
      locale: "en",
      title: `Festival ${i}`,
      description: "",
    });
  }
  for (let i = preferredCount; i < total; i += 1) {
    rows.push({
      $id: `t-no-${i}`,
      content_id: `n-no-${i}`,
      content_type: "news",
      locale: "no",
      title: `Festival ${i}`,
      description: "",
    });
  }
  return rows;
}

describe("locale-filtered search", () => {
  test("an English search does not surface a Norwegian-only match", async () => {
    const result = await service().search(GLOBAL_ADMIN(), {
      domain: "news",
      query: "Festival",
      locale: "en",
      ...PAGE,
    });
    const ids = result.rows.map((row) => row.id);
    expect(ids).toContain("n-both");
    expect(ids).not.toContain("n-no-only");
  });

  test("a Norwegian search finds both", async () => {
    const result = await service().search(GLOBAL_ADMIN(), {
      domain: "news",
      query: "Festival",
      locale: "no",
      ...PAGE,
    });
    const ids = result.rows.map((row) => row.id);
    expect(ids).toContain("n-both");
    expect(ids).toContain("n-no-only");
  });

  test("a scan that stopped short says so", async () => {
    // 250 translations match but only 200 are read, and the English filter
    // narrows those to 80 ids — under the 90-id batch ceiling, so the only
    // existing warning stays silent and the caller is told a partial search
    // was complete.
    const backend = createFakeBackend({
      tables: {
        news: [{ $id: "n-en-0", status: "published", campus_id: "1" }],
        content_translations: manyTranslations(80, 250),
      },
    });
    const result = await createContentService(backend, LINKS).search(
      GLOBAL_ADMIN(),
      { domain: "news", query: "Festival", locale: "en", ...PAGE }
    );

    expect(result.warnings.some((w) => TRUNCATED_I_RE.test(w))).toBe(true);
  });

  test("a scan that saw everything stays quiet", async () => {
    const backend = createFakeBackend({
      tables: {
        news: [{ $id: "n-en-0", status: "published", campus_id: "1" }],
        content_translations: manyTranslations(80, 150),
      },
    });
    const result = await createContentService(backend, LINKS).search(
      GLOBAL_ADMIN(),
      { domain: "news", query: "Festival", locale: "en", ...PAGE }
    );

    expect(result.warnings.some((w) => TRUNCATED_I_RE.test(w))).toBe(false);
  });

  test("the fallback still applies when no row matches the locale", async () => {
    // "stemning" exists only in Norwegian. An English search should fall back
    // rather than return nothing.
    const result = await service().search(GLOBAL_ADMIN(), {
      domain: "news",
      query: "stemning",
      locale: "en",
      ...PAGE,
    });
    expect(result.rows.map((row) => row.id)).toContain("n-no-only");
  });
});
