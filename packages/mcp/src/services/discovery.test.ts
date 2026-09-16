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
