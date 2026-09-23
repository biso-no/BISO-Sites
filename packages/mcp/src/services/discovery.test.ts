/**
 * Public discovery.
 *
 * These tools answer for signed-out visitors, so "what the public site shows"
 * is the specification. A vacancy stays `published` after its deadline passes,
 * so status alone is not "open" — `isRecruitmentVacancyOpen` in `@repo/shared`
 * is the repo's definition, and `apps/web` filters both its vacancy list and
 * its sitemap by it.
 */

import { describe, expect, test } from "bun:test";
import type { JobsStatus } from "@repo/api/types/appwrite";
import { isRecruitmentVacancyOpen } from "@repo/shared/types/recruitment";
import { createFakeBackend, type FakeRow } from "../testing/index";
import { createDiscoveryService } from "./discovery";

const LINKS = {
  web: (path: string) => `https://biso.no${path}`,
  admin: (path: string) => `https://admin.biso.no${path}`,
};

const PAST = "2020-01-01T00:00:00.000Z";
const FUTURE = "2099-01-01T00:00:00.000Z";

function tables() {
  return {
    jobs: [
      {
        $id: "open-with-deadline",
        $updatedAt: "2026-01-03T00:00:00.000Z",
        slug: "open-deadline",
        status: "published",
        campus_id: "1",
        application_deadline: FUTURE,
        translations: [],
      },
      {
        $id: "open-no-deadline",
        $updatedAt: "2026-01-02T00:00:00.000Z",
        slug: "open-no-deadline",
        status: "published",
        campus_id: "1",
        application_deadline: null,
        translations: [],
      },
      {
        $id: "closed-by-deadline",
        $updatedAt: "2026-01-01T00:00:00.000Z",
        slug: "closed",
        status: "published",
        campus_id: "1",
        application_deadline: PAST,
        translations: [],
      },
    ],
  };
}

function service() {
  return createDiscoveryService(createFakeBackend({ tables: tables() }), LINKS);
}

describe("public vacancy discovery", () => {
  test("a vacancy past its deadline is not offered", async () => {
    const result = await service().search({
      kind: "jobs",
      locale: "no",
      limit: 20,
      offset: 0,
    });
    const ids = result.rows.map((row) => row.id);
    expect(ids).not.toContain("closed-by-deadline");
  });

  test("open vacancies, with and without a deadline, are offered", async () => {
    const result = await service().search({
      kind: "jobs",
      locale: "no",
      limit: 20,
      offset: 0,
    });
    const ids = result.rows.map((row) => row.id);
    expect(ids).toContain("open-with-deadline");
    expect(ids).toContain("open-no-deadline");
  });

  test("the result agrees with the shared predicate row for row", async () => {
    // The point of this one: if the repo's definition of "open" moves, this
    // fails rather than quietly drifting from what the public site shows.
    const result = await service().search({
      kind: "jobs",
      locale: "no",
      limit: 20,
      offset: 0,
    });
    const returned = new Set(result.rows.map((row) => row.id));
    for (const job of tables().jobs) {
      const open = isRecruitmentVacancyOpen(
        job.status as JobsStatus,
        job.application_deadline
      );
      expect(returned.has(job.$id)).toBe(open);
    }
  });

  test("the total excludes closed vacancies, so paging stays truthful", async () => {
    const result = await service().search({
      kind: "jobs",
      locale: "no",
      limit: 20,
      offset: 0,
    });
    expect(result.total).toBe(2);
  });
});

describe("members-only vacancies", () => {
  /**
   * `audience` is not a visibility rule. A members-only vacancy is published
   * `read(any)` like any other, because advertising a role you could take as
   * a member is what sells the membership; the gate is on applying, checked
   * against live membership when the application is submitted. So public
   * discovery must keep offering the vacancy AND say that acting on it needs
   * a membership — telling a student nothing here means letting them write an
   * application that is refused on submit.
   */
  function audienceService() {
    return createDiscoveryService(
      createFakeBackend({
        tables: {
          jobs: [
            {
              $id: "members-only",
              $updatedAt: "2026-01-03T00:00:00.000Z",
              slug: "members-only",
              status: "published",
              campus_id: "1",
              application_deadline: FUTURE,
              metadata: JSON.stringify({ audience: "members" }),
              translations: [],
            },
            {
              $id: "open-to-all",
              $updatedAt: "2026-01-02T00:00:00.000Z",
              slug: "open-to-all",
              status: "published",
              campus_id: "1",
              application_deadline: FUTURE,
              metadata: JSON.stringify({ audience: "public" }),
              translations: [],
            },
            {
              $id: "no-metadata",
              $updatedAt: "2026-01-01T00:00:00.000Z",
              slug: "no-metadata",
              status: "published",
              campus_id: "1",
              application_deadline: FUTURE,
              metadata: null,
              translations: [],
            },
          ] satisfies FakeRow[],
        },
      }),
      LINKS
    );
  }

  async function searchVacancies() {
    const result = await audienceService().search({
      kind: "jobs",
      locale: "no",
      limit: 20,
      offset: 0,
    });
    return new Map(result.rows.map((row) => [row.id, row]));
  }

  test("a members-only vacancy is still offered to the public", async () => {
    const rows = await searchVacancies();
    expect(rows.has("members-only")).toBe(true);
  });

  test("it is flagged as requiring a membership to act on", async () => {
    const rows = await searchVacancies();
    expect(rows.get("members-only")?.memberOnly).toBe(true);
  });

  test("a vacancy open to everyone is not flagged", async () => {
    const rows = await searchVacancies();
    expect(rows.get("open-to-all")?.memberOnly).toBe(false);
  });

  test("a vacancy with no metadata at all is not flagged", async () => {
    // The column is optional, and an absent audience means "public" — never
    // an unexplained membership wall on a role anyone may apply for.
    const rows = await searchVacancies();
    expect(rows.get("no-metadata")?.memberOnly).toBe(false);
  });
});

describe("public page metadata and paging", () => {
  /**
   * The shape that leaks: a page is published, its translation is published,
   * and someone has since saved a draft. `saveDraft` writes the draft's
   * `meta.title`/`meta.description` into the translation row's top-level
   * columns while leaving `is_published` true — so those columns hold
   * unreleased copy on a page the public can read.
   */
  function doc(title: string, description: string, blockId: string) {
    return JSON.stringify({
      blocks: [{ id: blockId, type: "text" }],
      meta: { title, description, slug: "a-page", status: "published" },
    });
  }

  function pageWithNewerDraft() {
    return {
      pages: [
        {
          $id: "page-1",
          $updatedAt: "2026-02-01T00:00:00.000Z",
          slug: "a-page",
          status: "published",
          visibility: "public",
          campus_id: "1",
          translation_refs: [
            {
              $id: "tr-1",
              locale: "no",
              is_published: true,
              published_at: "2026-01-01T00:00:00.000Z",
              // What the draft overwrote these with:
              title: "UNRELEASED TITLE",
              description: "UNRELEASED DESCRIPTION",
              draft_document: doc(
                "UNRELEASED TITLE",
                "UNRELEASED DESCRIPTION",
                "draft-block"
              ),
              puck_document: doc(
                "Released title",
                "Released description",
                "live-block"
              ),
            },
          ],
        },
      ],
    };
  }

  test("public search reports the published title, not the draft's", async () => {
    const service = createDiscoveryService(
      createFakeBackend({ tables: pageWithNewerDraft() }),
      LINKS
    );
    const found = await service.search({
      kind: "pages",
      locale: "no",
      limit: 20,
      offset: 0,
    });

    expect(found.rows[0]?.title).toBe("Released title");
    expect(JSON.stringify(found.rows)).not.toContain("UNRELEASED");
  });

  test("get_page reports the published title and description", async () => {
    const service = createDiscoveryService(
      createFakeBackend({ tables: pageWithNewerDraft() }),
      LINKS
    );
    const page = await service.getPublicPage({ slug: "a-page", locale: "no" });

    expect(page.title).toBe("Released title");
    expect(page.description).toBe("Released description");
    // Blocks were already correct; assert they stayed that way.
    expect(page.blocks.map((block) => block.id)).toEqual(["live-block"]);
    expect(JSON.stringify(page)).not.toContain("UNRELEASED");
  });

  test("a page published before meta existed still renders its stored title", async () => {
    const tables = pageWithNewerDraft();
    const translations = (tables.pages[0] as Record<string, unknown>)
      .translation_refs as Record<string, unknown>[];
    translations[0].puck_document = JSON.stringify({ blocks: [] });
    translations[0].title = "Legacy title";

    const service = createDiscoveryService(
      createFakeBackend({ tables }),
      LINKS
    );
    const page = await service.getPublicPage({ slug: "a-page", locale: "no" });
    expect(page.title).toBe("Legacy title");
  });

  test("published pages behind unpublished-translation rows are reachable", async () => {
    // 25 pages whose parent says published but whose translation is not, then
    // one that really is. A single 20-row window returned nothing before.
    const pages: FakeRow[] = [];
    for (let index = 0; index < 25; index += 1) {
      pages.push({
        $id: `unpublished-${index}`,
        $updatedAt: `2026-03-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
        slug: `hidden-${index}`,
        status: "published",
        visibility: "public",
        campus_id: "1",
        translation_refs: [
          {
            $id: `t${index}`,
            locale: "no",
            is_published: false,
            title: "Draft",
          },
        ],
      });
    }
    pages.push({
      $id: "really-published",
      $updatedAt: "2026-01-01T00:00:00.000Z",
      slug: "visible",
      status: "published",
      visibility: "public",
      campus_id: "1",
      translation_refs: [
        {
          $id: "tp",
          locale: "no",
          is_published: true,
          published_at: "2026-01-01T00:00:00.000Z",
          title: "Visible",
          puck_document: doc("Visible", "d", "b"),
        },
      ],
    });

    const service = createDiscoveryService(
      createFakeBackend({ tables: { pages } }),
      LINKS
    );
    const found = await service.search({
      kind: "pages",
      locale: "no",
      limit: 20,
      offset: 0,
    });

    expect(found.rows.map((row) => row.id)).toEqual(["really-published"]);
    expect(found.total).toBeNull();
  });
});

describe("public unit discovery", () => {
  /**
   * `departments` mirrors the chart of accounts, so a public listing has to
   * drop operating ledgers and national governance rows — a name rule no
   * Appwrite filter can express. Reading one fixed window and filtering it
   * locally made that window the whole searchable universe.
   */
  function manyUnits(): FakeRow[] {
    const rows: FakeRow[] = [];
    // 120 ledger rows sort before "ESN …" alphabetically and are all excluded,
    // so a single 100-row window contains nothing a visitor may see.
    for (let index = 0; index < 120; index += 1) {
      rows.push({
        $id: `ledger-${index}`,
        Name: `Drift Campus ${String(index).padStart(3, "0")}`,
        campus_id: "1",
        slug: `drift-${index}`,
        type: "ledger",
        active: true,
      });
    }
    rows.push({
      $id: "real-unit",
      Name: "ESN Oslo",
      campus_id: "1",
      slug: "esn",
      type: "unit",
      active: true,
    });
    return rows;
  }

  test("a unit behind the first scan window is still reachable", async () => {
    const service = createDiscoveryService(
      createFakeBackend({ tables: { departments: manyUnits() } }),
      LINKS
    );
    const found = await service.search({
      kind: "units",
      locale: "no",
      limit: 20,
      offset: 0,
    });

    expect(found.rows.map((row) => row.id)).toEqual(["real-unit"]);
  });

  test("the unit listing does not report a filtered window as the total", async () => {
    const service = createDiscoveryService(
      createFakeBackend({ tables: { departments: manyUnits() } }),
      LINKS
    );
    const found = await service.search({
      kind: "units",
      locale: "no",
      limit: 20,
      offset: 0,
    });

    expect(found.total).toBeNull();
    expect(found.nextOffset).toBeNull();
  });
});

describe("public benefit discovery", () => {
  function benefits(): FakeRow[] {
    return [
      {
        $id: "oslo-benefit",
        $updatedAt: "2026-01-02T00:00:00.000Z",
        campus_id: "1",
        status: "published",
        title_nb: "Oslo-fordel",
        is_member_only: false,
      },
      {
        $id: "national-benefit",
        $updatedAt: "2026-01-01T00:00:00.000Z",
        campus_id: "5",
        status: "published",
        title_nb: "Nasjonal fordel",
        is_member_only: false,
      },
    ];
  }

  test("omitting a campus lists benefits from every campus", async () => {
    // `resolveBenefitCampusIds(null)` answers "national only", which is right
    // for the member portal and wrong for an optional search filter.
    const service = createDiscoveryService(
      createFakeBackend({ tables: { campus_benefits: benefits() } }),
      LINKS
    );
    const found = await service.search({
      kind: "benefits",
      locale: "no",
      limit: 20,
      offset: 0,
    });

    expect(found.rows.map((row) => row.id).sort()).toEqual([
      "national-benefit",
      "oslo-benefit",
    ]);
  });

  test("a requested campus still includes national benefits", async () => {
    const service = createDiscoveryService(
      createFakeBackend({ tables: { campus_benefits: benefits() } }),
      LINKS
    );
    const found = await service.search({
      kind: "benefits",
      campusId: "1",
      locale: "no",
      limit: 20,
      offset: 0,
    });

    expect(found.rows.map((row) => row.id).sort()).toEqual([
      "national-benefit",
      "oslo-benefit",
    ]);
  });

  test("a requested campus excludes another campus's benefits", async () => {
    const service = createDiscoveryService(
      createFakeBackend({ tables: { campus_benefits: benefits() } }),
      LINKS
    );
    const found = await service.search({
      kind: "benefits",
      campusId: "2",
      locale: "no",
      limit: 20,
      offset: 0,
    });

    expect(found.rows.map((row) => row.id)).toEqual(["national-benefit"]);
  });
});

describe("free-text terms the public path cannot apply", () => {
  /**
   * The tool documents that `notes` says when a term was not applied. Only
   * `pages` applies one, and only against the slug; four kinds used to drop it
   * in silence under a summary that reads as though the results match it.
   */
  const SILENT_KINDS = ["events", "benefits", "units", "documents"] as const;

  for (const kind of SILENT_KINDS) {
    test(`${kind} says the term was not applied`, async () => {
      const service = createDiscoveryService(
        createFakeBackend({ tables: {} }),
        LINKS
      );
      const found = await service.search({
        kind,
        query: "welcome week",
        locale: "no",
        limit: 20,
        offset: 0,
      });

      expect(found.notes.join(" ")).toContain("was not applied");
    });
  }

  test("no note is added when no term was given", async () => {
    const service = createDiscoveryService(
      createFakeBackend({ tables: {} }),
      LINKS
    );
    const found = await service.search({
      kind: "events",
      locale: "no",
      limit: 20,
      offset: 0,
    });

    expect(found.notes.join(" ")).not.toContain("was not applied");
  });

  test("pages says the term only matched the slug", async () => {
    const service = createDiscoveryService(
      createFakeBackend({ tables: { pages: [] } }),
      LINKS
    );
    const found = await service.search({
      kind: "pages",
      query: "welcome",
      locale: "no",
      limit: 20,
      offset: 0,
    });

    expect(found.notes.join(" ")).toContain("page slug only");
  });
});

describe("locale preference in page search", () => {
  function bilingualPage(): FakeRow[] {
    return [
      {
        $id: "bilingual",
        $updatedAt: "2026-01-01T00:00:00.000Z",
        slug: "bilingual",
        status: "published",
        visibility: "public",
        campus_id: "1",
        // English first in the relationship array, which is the whole point:
        // the order rows come back in is not a locale preference.
        translation_refs: [
          {
            $id: "tr-en",
            locale: "en",
            is_published: true,
            published_at: "2026-01-01T00:00:00.000Z",
            title: "English column",
            puck_document: JSON.stringify({
              blocks: [],
              meta: { title: "English title", description: "English" },
            }),
          },
          {
            $id: "tr-no",
            locale: "no",
            is_published: true,
            published_at: "2026-01-01T00:00:00.000Z",
            title: "Norsk kolonne",
            puck_document: JSON.stringify({
              blocks: [],
              meta: { title: "Norsk tittel", description: "Norsk" },
            }),
          },
        ],
      },
    ];
  }

  test("a Norwegian search gets the Norwegian title", async () => {
    const service = createDiscoveryService(
      createFakeBackend({ tables: { pages: bilingualPage() } }),
      LINKS
    );
    const found = await service.search({
      kind: "pages",
      locale: "no",
      limit: 20,
      offset: 0,
    });

    expect(found.rows[0]?.title).toBe("Norsk tittel");
  });

  test("an English search gets the English title", async () => {
    const service = createDiscoveryService(
      createFakeBackend({ tables: { pages: bilingualPage() } }),
      LINKS
    );
    const found = await service.search({
      kind: "pages",
      locale: "en",
      limit: 20,
      offset: 0,
    });

    expect(found.rows[0]?.title).toBe("English title");
  });

  test("an unpublished locale falls back to a published one", async () => {
    const rows = bilingualPage();
    const refs = rows[0]?.translation_refs as Record<string, unknown>[];
    refs[1].is_published = false;
    const service = createDiscoveryService(
      createFakeBackend({ tables: { pages: rows } }),
      LINKS
    );
    const found = await service.search({
      kind: "pages",
      locale: "no",
      limit: 20,
      offset: 0,
    });

    expect(found.rows[0]?.title).toBe("English title");
  });
});

describe("the events date filter", () => {
  /**
   * An event that starts at 00:30 Oslo on 22 September — `2026-09-21T22:30Z`
   * once stored. It belongs to the Oslo day a caller names, but sits before
   * UTC midnight, so a `from` compared as written drops it from its own day.
   */
  const EARLY_ON_THE_22ND = "2026-09-21T22:30:00.000Z";

  function eventTables() {
    return {
      events: [
        {
          $id: "early",
          $updatedAt: "2026-01-02T00:00:00.000Z",
          slug: "early",
          status: "published",
          campus_id: "1",
          start_date: EARLY_ON_THE_22ND,
          translation_refs: [],
        } as FakeRow,
      ],
      campus: [{ $id: "1", name: "Oslo" } as FakeRow],
    };
  }

  function service() {
    return createDiscoveryService(
      createFakeBackend({ tables: eventTables() }),
      LINKS
    );
  }

  test("a bare date keeps an event starting early on that Oslo day", async () => {
    const found = await service().search({
      kind: "events",
      from: "2026-09-22",
      limit: 25,
      offset: 0,
    });
    expect(found.rows.map((row) => row.id)).toEqual(["early"]);
  });

  test("a bare date still excludes the day before", async () => {
    // The resolution must move the boundary, not remove it.
    const found = await service().search({
      kind: "events",
      from: "2026-09-23",
      limit: 25,
      offset: 0,
    });
    expect(found.rows).toEqual([]);
  });

  test("a full instant is used exactly as given", async () => {
    // 22:45Z is after the event, so it must not come back — if the filter
    // re-resolved a full timestamp against Oslo it would shift two hours and
    // let it through.
    const found = await service().search({
      kind: "events",
      from: "2026-09-21T22:45:00.000Z",
      limit: 25,
      offset: 0,
    });
    expect(found.rows).toEqual([]);
  });
});

describe("public links and campus scope match the public site", () => {
  test("a unit link uses the canonical campus segment, not the campus id", async () => {
    // `/units/2/fadderullan` 404s: the public route resolves the segment with
    // `campusSegmentToId`, which answers null for "2". The convention lives in
    // `@repo/shared/utils/unit-urls` and backs every other producer of these
    // links, so discovery has to go through it too.
    const service = createDiscoveryService(
      createFakeBackend({
        tables: {
          departments: [
            {
              $id: "u-1",
              Name: "Fadderullan",
              campus_id: "2",
              slug: "fadderullan",
              type: "unit",
              active: true,
            } as FakeRow,
          ],
        },
      }),
      LINKS
    );
    const found = await service.search({
      kind: "units",
      locale: "no",
      limit: 20,
      offset: 0,
    });

    expect(found.rows[0]?.url).toBe("https://biso.no/units/bergen/fadderullan");
  });

  test("a campus filter keeps the national documents the site always shows", async () => {
    // `listPublishedDocuments` in `apps/web` runs two queries and merges them,
    // and says why: national documents are shown "regardless of campus
    // filter", because their visibility comes from `scope`. Filtering on
    // `campus_id` alone hid every statute from a campus-scoped search.
    const service = createDiscoveryService(
      createFakeBackend({
        tables: {
          documents: [
            {
              $id: "statutes",
              $updatedAt: "2026-01-02T00:00:00.000Z",
              title: "Statutes",
              status: "published",
              scope: "national",
              campus_id: null,
              category: "governing",
              sort_order: 1,
            } as FakeRow,
            {
              $id: "oslo-bylaws",
              $updatedAt: "2026-01-02T00:00:00.000Z",
              title: "Oslo bylaws",
              status: "published",
              scope: "campus",
              campus_id: "1",
              category: "campus-bylaws",
              sort_order: 2,
            } as FakeRow,
            {
              $id: "bergen-bylaws",
              $updatedAt: "2026-01-02T00:00:00.000Z",
              title: "Bergen bylaws",
              status: "published",
              scope: "campus",
              campus_id: "2",
              category: "campus-bylaws",
              sort_order: 3,
            } as FakeRow,
          ],
          campus: [{ $id: "1", name: "Oslo" } as FakeRow],
        },
      }),
      LINKS
    );
    const found = await service.search({
      kind: "documents",
      campusId: "1",
      locale: "no",
      limit: 20,
      offset: 0,
    });

    const ids = found.rows.map((row) => row.id);
    expect(ids).toContain("statutes");
    expect(ids).toContain("oslo-bylaws");
    // Still a campus filter: another campus's bylaws stay out.
    expect(ids).not.toContain("bergen-bylaws");
  });
});

describe("public feeds carry National content and hide collection children", () => {
  function eventRow(id: string, extra: Record<string, unknown>): FakeRow {
    return {
      $id: id,
      $updatedAt: "2026-01-02T00:00:00.000Z",
      slug: id,
      status: "published",
      start_date: "2026-01-05T10:00:00.000Z",
      translation_refs: [],
      ...extra,
    } as FakeRow;
  }

  const tables = () => ({
    events: [
      eventRow("oslo-standalone", { campus_id: "1", collection_id: null }),
      eventRow("national-standalone", { campus_id: "5", collection_id: null }),
      eventRow("bergen-standalone", { campus_id: "2", collection_id: null }),
      eventRow("the-collection", {
        campus_id: "1",
        is_collection: true,
        collection_id: null,
      }),
      eventRow("child-of-collection", {
        campus_id: "1",
        collection_id: "the-collection",
      }),
    ],
    campus: [{ $id: "1", name: "Oslo" } as FakeRow],
  });

  test("a campus filter keeps National events, as the site does", async () => {
    // `campusScopeIds` in `apps/web` returns `[campus, "5"]` precisely so
    // organisation-wide content rides along with every study campus.
    const found = await createDiscoveryService(
      createFakeBackend({ tables: tables() }),
      LINKS
    ).search({
      kind: "events",
      campusId: "1",
      locale: "no",
      limit: 25,
      offset: 0,
    });

    const ids = found.rows.map((row) => row.id);
    expect(ids).toContain("oslo-standalone");
    expect(ids).toContain("national-standalone");
    expect(ids).not.toContain("bergen-standalone");
  });

  test("selecting National returns National alone", async () => {
    // It is already the widest bucket; widening it again would return every
    // campus's content under a National filter.
    const found = await createDiscoveryService(
      createFakeBackend({ tables: tables() }),
      LINKS
    ).search({
      kind: "events",
      campusId: "5",
      locale: "no",
      limit: 25,
      offset: 0,
    });

    expect(found.rows.map((row) => row.id)).toEqual(["national-standalone"]);
  });

  test("a collection's children are not returned as independent events", async () => {
    const found = await createDiscoveryService(
      createFakeBackend({ tables: tables() }),
      LINKS
    ).search({ kind: "events", locale: "no", limit: 25, offset: 0 });

    const ids = found.rows.map((row) => row.id);
    expect(ids).toContain("the-collection");
    expect(ids).toContain("oslo-standalone");
    expect(ids).not.toContain("child-of-collection");
  });
});
