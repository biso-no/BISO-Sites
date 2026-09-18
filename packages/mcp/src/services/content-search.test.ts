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

/**
 * Link-only products.
 *
 * `unlisted` arrived with PR #76. It is orthogonal to `status` and to
 * `member_only`: an unlisted product is published and fully purchasable at its
 * `/shop/<slug>` link, and `listedProductsOnly()` keeps it out of every public
 * listing (`apps/web/src/lib/data/product-visibility.ts`).
 *
 * Nothing here can leak one — `biso_content_search` is staff-only and
 * `scopeQueries` fails closed — so the defect this covers is a reporting one: a
 * summary carrying `status` and `member_only` but not `unlisted` lets a staff
 * caller conclude a product is publicly discoverable when it is deliberately
 * not. The column has to be in the projection for the answer to exist at all;
 * an unselected column reads as `undefined`, which is indistinguishable from
 * "listed".
 */
describe("product link-only status", () => {
  function shop() {
    return createContentService(
      createFakeBackend({
        tables: {
          campus: [{ $id: "1", name: "Oslo" }],
          webshop_products: [
            {
              $id: "p-listed",
              status: "published",
              campus_id: "1",
              slug: "hoodie",
              member_only: false,
              unlisted: false,
            },
            {
              $id: "p-link-only",
              status: "published",
              campus_id: "1",
              slug: "staff-jacket",
              member_only: false,
              unlisted: true,
            },
          ],
        },
      }),
      LINKS
    );
  }

  test("a product summary says whether it is link-only", async () => {
    const result = await shop().search(GLOBAL_ADMIN(), {
      domain: "products",
      ...PAGE,
    });
    const byId = new Map(result.rows.map((row) => [row.id, row.fields]));

    expect(byId.get("p-link-only")?.unlisted).toBe(true);
    expect(byId.get("p-listed")?.unlisted).toBe(false);
  });

  test("a link-only product is still found, not filtered out", async () => {
    // The app's listing filter is the app's. Withholding the row here would
    // hide a product from the staff who own it, which is the opposite defect.
    const result = await shop().search(GLOBAL_ADMIN(), {
      domain: "products",
      ...PAGE,
    });
    expect(result.rows.map((row) => row.id)).toContain("p-link-only");
  });
});
