/**
 * Page document tests.
 *
 * The headline property: an edit either changes the document and says so, or
 * changes nothing and says THAT. The editor's own AI tools report
 * `{status: "applied", message: "Inserted hero block at end"}` unconditionally,
 * including for a block id that does not exist, so a caller cannot tell a real
 * edit from a no-op. These tests pin the opposite behaviour.
 *
 * Also covered: draft visibility (the `pages` table has row security disabled,
 * so the filter has to be here), optimistic concurrency, and the brand-accent
 * guard.
 */

import { describe, expect, test } from "bun:test";
import type { PageDoc } from "@repo/api/page-builder";
import { DomainError } from "../runtime/errors";
import {
  CAMPUS_ADMIN,
  createFakeBackend,
  DEPARTMENT_MEMBER,
  type FakeRow,
  type FakeTables,
  GLOBAL_ADMIN,
} from "../testing/index";
import { createPageService } from "./pages";

const INSERTED_A_TEXT_BLOCK_WITH_ID_RE = /Inserted a "text" block with id/;
const NOW_HAS_BLOCKS_RE = /now has 2 blocks/;
const NOTHING_WAS_REMOVED_I_RE = /nothing was removed/i;
const NOTHING_WAS_SET_I_RE = /nothing was set/i;
const FROM_INDEX_TO_RE = /from index 2 to 0/;
const NOT_AN_APPROVED_BISO_ACCENT_I_RE = /not an approved BISO accent/i;
const NO_PAGE_FOUND_I_RE = /no page found/i;
const NO_PUBLISHED_DOCUMENT_I_RE = /no published .* document/i;
const NO_EN_TRANSLATION_I_RE = /no en translation/i;
const CHANGED_SINCE_IT_WAS_READ_I_RE = /changed since it was read/i;
const DO_NOT_MANAGE_I_RE = /do not manage/i;
const NO_NO_DRAFT_TO_PUBLISH_I_RE = /no no draft to publish/i;
const NO_WRITE_ACCESS_TO_THIS_DEPARTMENT_I_RE =
  /no write access to this department/i;
const MALFORMED_I_RE = /is malformed, so it was not published/i;

const LINKS = {
  web: (path: string) => `https://biso.no${path}`,
  admin: (path: string) => `https://admin.biso.no${path}`,
};

function doc(blocks: unknown[] = []): PageDoc {
  return {
    blocks,
    meta: {
      accentColor: "#3DA9E0",
      department: "dept-a",
      slug: "test-page",
      status: "draft",
      title: "Test page",
      description: "A page",
    },
  };
}

function tablesWith(overrides: Partial<FakeTables> = {}): FakeTables {
  return {
    pages: [
      {
        $id: "page-1",
        $createdAt: "2026-01-01T00:00:00.000Z",
        $updatedAt: "2026-01-01T00:00:00.000Z",
        slug: "test-page",
        status: "draft",
        visibility: "public",
        campus_id: "1",
        department_id: "dept-a",
        campus: { $id: "1" },
        department: { $id: "dept-a" },
        translation_refs: [
          {
            $id: "tr-1",
            $updatedAt: "2026-01-01T00:00:00.000Z",
            locale: "no",
            title: "Test page",
            description: "A page",
            is_published: false,
            published_at: null,
            draft_document: JSON.stringify(
              doc([
                { id: "b-1", type: "hero", title: "Welcome" },
                { id: "b-2", type: "text", body: "Hello" },
              ])
            ),
            puck_document: null,
          },
        ],
      },
    ],
    page_translations: [],
    ...overrides,
  };
}

describe("applyEdits", () => {
  const backend = createFakeBackend({ tables: tablesWith() });
  const service = createPageService(backend, LINKS);

  test("insert reports the new block id and the new count", () => {
    const { doc: next, outcomes } = service.applyEdits(
      doc([{ id: "b-1", type: "hero" }]),
      [{ op: "insert", blockType: "text" }]
    );
    expect(next.blocks).toHaveLength(2);
    expect(outcomes[0].applied).toBe(true);
    expect(outcomes[0].detail).toMatch(INSERTED_A_TEXT_BLOCK_WITH_ID_RE);
    expect(outcomes[0].detail).toMatch(NOW_HAS_BLOCKS_RE);
  });

  test("insert after a block puts it in the right place", () => {
    const { doc: next } = service.applyEdits(
      doc([
        { id: "b-1", type: "hero" },
        { id: "b-2", type: "text" },
      ]),
      [{ op: "insert", blockType: "cta", afterBlockId: "b-1" }]
    );
    expect((next.blocks[1] as { type: string }).type).toBe("cta");
  });

  test("inserting after a block that does not exist is reported as NOT applied", () => {
    // `insertBlock` computes `findIndex(...) + 1`, so an unknown anchor
    // becomes index 0 and the block lands at the TOP of the page — its own
    // `idx < 0` guard can never fire. Reporting that as "inserted after <id>"
    // both contradicts this tool's contract and silently reorders a live page.
    const { doc: next, outcomes } = service.applyEdits(
      doc([
        { id: "b-1", type: "hero" },
        { id: "b-2", type: "text" },
      ]),
      [{ op: "insert", blockType: "cta", afterBlockId: "does-not-exist" }]
    );
    expect(outcomes[0].applied).toBe(false);
    expect(next.blocks).toHaveLength(2);
    expect((next.blocks[0] as { id: string }).id).toBe("b-1");
  });

  test("removing a block that does not exist is reported as NOT applied", () => {
    // This is the exact case the editor's advisory tools report as success.
    const { doc: next, outcomes } = service.applyEdits(
      doc([{ id: "b-1", type: "hero" }]),
      [{ op: "remove", blockId: "does-not-exist" }]
    );
    expect(next.blocks).toHaveLength(1);
    expect(outcomes[0].applied).toBe(false);
    expect(outcomes[0].detail).toMatch(NOTHING_WAS_REMOVED_I_RE);
  });

  test("setting a prop on a missing block is reported as NOT applied", () => {
    const { outcomes } = service.applyEdits(
      doc([{ id: "b-1", type: "hero" }]),
      [{ op: "set_prop", blockId: "nope", path: "title", value: "x" }]
    );
    expect(outcomes[0].applied).toBe(false);
    expect(outcomes[0].detail).toMatch(NOTHING_WAS_SET_I_RE);
  });

  test("set_prop actually changes the value", () => {
    const { doc: next, outcomes } = service.applyEdits(
      doc([{ id: "b-1", type: "hero", title: "Old" }]),
      [{ op: "set_prop", blockId: "b-1", path: "title", value: "New" }]
    );
    expect((next.blocks[0] as { title: string }).title).toBe("New");
    expect(outcomes[0].applied).toBe(true);
  });

  test("set_prop supports nested paths", () => {
    const { doc: next } = service.applyEdits(
      doc([{ id: "b-1", type: "faq", items: [{ q: "a" }] }]),
      [{ op: "set_prop", blockId: "b-1", path: "items.0.q", value: "b" }]
    );
    expect((next.blocks[0] as { items: Array<{ q: string }> }).items[0].q).toBe(
      "b"
    );
  });

  test("move reorders and reports both indices", () => {
    const { doc: next, outcomes } = service.applyEdits(
      doc([
        { id: "b-1", type: "hero" },
        { id: "b-2", type: "text" },
        { id: "b-3", type: "cta" },
      ]),
      [{ op: "move", blockId: "b-3", toIndex: 0 }]
    );
    expect((next.blocks[0] as { id: string }).id).toBe("b-3");
    expect(outcomes[0].detail).toMatch(FROM_INDEX_TO_RE);
  });

  test("an out-of-range move index is clamped, not an error", () => {
    const { doc: next, outcomes } = service.applyEdits(
      doc([
        { id: "b-1", type: "hero" },
        { id: "b-2", type: "text" },
      ]),
      [{ op: "move", blockId: "b-1", toIndex: 99 }]
    );
    expect(outcomes[0].applied).toBe(true);
    expect((next.blocks[1] as { id: string }).id).toBe("b-1");
  });

  test("an off-brand accent is REFUSED, not written", () => {
    const { doc: next, outcomes } = service.applyEdits(doc(), [
      { op: "set_accent", hex: "#ff00ff" },
    ]);
    expect(outcomes[0].applied).toBe(false);
    expect(outcomes[0].detail).toMatch(NOT_AN_APPROVED_BISO_ACCENT_I_RE);
    expect(next.meta.accentColor).toBe("#3DA9E0");
  });

  test("an approved accent is applied", () => {
    const { doc: next, outcomes } = service.applyEdits(doc(), [
      { op: "set_accent", hex: "#F7D64A" },
    ]);
    expect(outcomes[0].applied).toBe(true);
    expect(next.meta.accentColor).toBe("#F7D64A");
  });

  test("the caller's document is never mutated in place", () => {
    const original = doc([{ id: "b-1", type: "hero", title: "Old" }]);
    service.applyEdits(original, [
      { op: "set_prop", blockId: "b-1", path: "title", value: "New" },
    ]);
    expect((original.blocks[0] as { title: string }).title).toBe("Old");
  });

  test("a mixed batch reports each edit independently", () => {
    const { outcomes } = service.applyEdits(
      doc([{ id: "b-1", type: "hero" }]),
      [
        { op: "set_prop", blockId: "b-1", path: "title", value: "Yes" },
        { op: "remove", blockId: "ghost" },
        { op: "insert", blockType: "cta" },
      ]
    );
    expect(outcomes.map((o) => o.applied)).toEqual([true, false, true]);
  });
});

describe("load", () => {
  test("returns the real blocks on the persisted document", async () => {
    const backend = createFakeBackend({ tables: tablesWith() });
    const service = createPageService(backend, LINKS);
    const view = await service.load(GLOBAL_ADMIN(), {
      pageId: "page-1",
      locale: "no",
    });
    expect(view.blockCount).toBe(2);
    expect(view.blocks.map((b) => b.type)).toEqual(["hero", "text"]);
    expect(view.blocks[0].id).toBe("b-1");
    expect(view.revision).toBe("2026-01-01T00:00:00.000Z");
  });

  test("a draft page is hidden from a principal outside its scope", async () => {
    // `pages` has rowSecurity disabled and a table-level read(any) grant, so
    // Appwrite hands the row over; the filter has to be ours.
    const backend = createFakeBackend({ tables: tablesWith() });
    const service = createPageService(backend, LINKS);
    await expect(
      service.load(CAMPUS_ADMIN("Bergen", "2"), {
        pageId: "page-1",
        locale: "no",
      })
    ).rejects.toThrow(NO_PAGE_FOUND_I_RE);
  });

  test("a draft page is visible to the owning department", async () => {
    const backend = createFakeBackend({ tables: tablesWith() });
    const service = createPageService(backend, LINKS);
    const view = await service.load(DEPARTMENT_MEMBER("dept-a", "1"), {
      pageId: "page-1",
      locale: "no",
    });
    expect(view.page.id).toBe("page-1");
  });

  test("a published page's published document is visible regardless of scope", async () => {
    // The page must actually have a released document. Flipping `status` alone
    // leaves the translation draft-only, and serving *that* out of scope is the
    // leak covered in "draft visibility on a published page" below.
    const tables = tablesWith();
    const page = tables.pages[0] as Record<string, unknown>;
    page.status = "published";
    const translations = page.translation_refs as Record<string, unknown>[];
    translations[0].puck_document = JSON.stringify(
      doc([{ id: "live", type: "text", body: "Released copy" }])
    );
    // A document alone is not a released locale: unpublishing leaves the
    // document in place and only clears this flag, so the fixture has to set
    // it to express the state the test is about.
    translations[0].is_published = true;

    const backend = createFakeBackend({ tables });
    const service = createPageService(backend, LINKS);
    const view = await service.load(CAMPUS_ADMIN("Bergen", "2"), {
      pageId: "page-1",
      locale: "no",
    });
    expect(view.page.id).toBe("page-1");
    expect(view.documentSource).toBe("published");
  });

  test("a withdrawn locale is not served from its retained document", async () => {
    // Unpublishing a locale writes `is_published: false` and leaves
    // `puck_document` alone. Publish another locale and the parent row is
    // `published` again — at which point the document alone cannot tell a
    // released locale from a withdrawn one. The public route asks
    // `translation.is_published` before rendering; so does this.
    const tables = tablesWith();
    const page = tables.pages[0] as Record<string, unknown>;
    page.status = "published";
    const translations = page.translation_refs as Record<string, unknown>[];
    translations[0].puck_document = JSON.stringify(
      doc([{ id: "withdrawn", type: "text", body: "Taken down" }])
    );
    translations[0].is_published = false;

    const backend = createFakeBackend({ tables });
    const service = createPageService(backend, LINKS);
    await expect(
      service.load(CAMPUS_ADMIN("Bergen", "2"), {
        pageId: "page-1",
        locale: "no",
      })
    ).rejects.toThrow(NO_PUBLISHED_DOCUMENT_I_RE);
  });

  test("a member-only page is not readable by a staff caller who is not a member", async () => {
    // `pageRowPermissions` grants a published `visibility: "authenticated"`
    // page a read for the members team alone. A staff principal comes from
    // campus and department teams and proves nothing about membership, and
    // this table has row security off with a table-level `read("any")`, so
    // this check is the only audience boundary there is.
    const tables = tablesWith();
    const page = tables.pages[0] as Record<string, unknown>;
    page.status = "published";
    page.visibility = "authenticated";
    const translations = page.translation_refs as Record<string, unknown>[];
    translations[0].puck_document = JSON.stringify(
      doc([{ id: "members", type: "text", body: "Members only" }])
    );
    translations[0].is_published = true;

    const service = createPageService(createFakeBackend({ tables }), LINKS);
    await expect(
      service.load(CAMPUS_ADMIN("Bergen", "2"), {
        pageId: "page-1",
        locale: "no",
      })
    ).rejects.toThrow(NO_PAGE_FOUND_I_RE);
  });

  test("a member-only page is readable by a member", async () => {
    // The fix must not lock out the audience it exists to protect.
    const tables = tablesWith();
    const page = tables.pages[0] as Record<string, unknown>;
    page.status = "published";
    page.visibility = "authenticated";
    const translations = page.translation_refs as Record<string, unknown>[];
    translations[0].puck_document = JSON.stringify(
      doc([{ id: "members", type: "text", body: "Members only" }])
    );
    translations[0].is_published = true;

    const service = createPageService(createFakeBackend({ tables }), LINKS);
    const view = await service.load(
      { ...CAMPUS_ADMIN("Bergen", "2"), isMember: true },
      { pageId: "page-1", locale: "no" }
    );
    expect(view.documentSource).toBe("published");
  });

  test("a missing locale reports not found rather than an empty document", async () => {
    const backend = createFakeBackend({ tables: tablesWith() });
    const service = createPageService(backend, LINKS);
    await expect(
      service.load(GLOBAL_ADMIN(), { pageId: "page-1", locale: "en" })
    ).rejects.toThrow(NO_EN_TRANSLATION_I_RE);
  });
});

describe("list", () => {
  test("drafts outside scope are filtered out and the total reflects that", async () => {
    const tables = tablesWith();
    tables.pages.push({
      $id: "page-2",
      $updatedAt: "2026-01-02T00:00:00.000Z",
      slug: "bergen-page",
      status: "draft",
      visibility: "public",
      campus_id: "2",
      department_id: "dept-b",
      campus: { $id: "2" },
      department: { $id: "dept-b" },
      translation_refs: [],
    });
    const backend = createFakeBackend({ tables });
    const service = createPageService(backend, LINKS);

    const asOslo = await service.list(CAMPUS_ADMIN("Oslo", "1"), {
      limit: 20,
      offset: 0,
    });
    expect(asOslo.rows.map((row) => row.id)).toEqual(["page-1"]);
    // `total` is deliberately unknown: counting what this caller may see would
    // mean scanning the whole table, and Appwrite's own total would disclose
    // how many pages exist that they may not see.
    expect(asOslo.total).toBeNull();

    const asGlobal = await service.list(GLOBAL_ADMIN(), {
      limit: 20,
      offset: 0,
    });
    expect(asGlobal.rows).toHaveLength(2);
  });

  /**
   * The load path learned this rule a round before the listing did. A summary
   * carries the slug, the owning campus and department, and both the admin and
   * the public link — so a listing that waves every published row through
   * hands a member-only page's whole identity to a staff caller the load path
   * would refuse. Both now come from one predicate.
   */
  function memberOnlyPublished(): FakeTables {
    const tables = tablesWith();
    const page = tables.pages[0] as Record<string, unknown>;
    page.status = "published";
    page.visibility = "authenticated";
    return tables;
  }

  test("a member-only page is not listed to a staff caller who is not a member", async () => {
    const service = createPageService(
      createFakeBackend({ tables: memberOnlyPublished() }),
      LINKS
    );
    const found = await service.list(CAMPUS_ADMIN("Bergen", "2"), {
      limit: 20,
      offset: 0,
    });
    expect(found.rows.map((row) => row.id)).toEqual([]);
  });

  test("a member-only page is listed to a member", async () => {
    const service = createPageService(
      createFakeBackend({ tables: memberOnlyPublished() }),
      LINKS
    );
    const found = await service.list(
      { ...CAMPUS_ADMIN("Bergen", "2"), isMember: true },
      { limit: 20, offset: 0 }
    );
    expect(found.rows.map((row) => row.id)).toEqual(["page-1"]);
  });

  test("the owning campus still sees its own member-only page", async () => {
    // Ownership is checked before the published branch, so a board editing a
    // member-only page does not lose it from their own listing.
    const service = createPageService(
      createFakeBackend({ tables: memberOnlyPublished() }),
      LINKS
    );
    const found = await service.list(CAMPUS_ADMIN("Oslo", "1"), {
      limit: 20,
      offset: 0,
    });
    expect(found.rows.map((row) => row.id)).toEqual(["page-1"]);
  });
});

describe("saveDraft", () => {
  test("refuses a stale revision", async () => {
    const backend = createFakeBackend({ tables: tablesWith() });
    const service = createPageService(backend, LINKS);
    await expect(
      service.saveDraft(GLOBAL_ADMIN(), {
        pageId: "page-1",
        locale: "no",
        doc: doc(),
        expectedRevision: "2020-01-01T00:00:00.000Z",
      })
    ).rejects.toThrow(CHANGED_SINCE_IT_WAS_READ_I_RE);
  });

  test("refuses a principal outside the page's scope", async () => {
    const backend = createFakeBackend({ tables: tablesWith() });
    const service = createPageService(backend, LINKS);
    await expect(
      service.saveDraft(CAMPUS_ADMIN("Bergen", "2"), {
        pageId: "page-1",
        locale: "no",
        doc: doc(),
        expectedRevision: null,
      })
    ).rejects.toThrow(DO_NOT_MANAGE_I_RE);
  });

  test("writes a draft with NO public read permission", async () => {
    // An unpublished translation must not be readable by `any`.
    const backend = createFakeBackend({ tables: tablesWith() });
    const service = createPageService(backend, LINKS);
    await service.saveDraft(GLOBAL_ADMIN(), {
      pageId: "page-1",
      locale: "no",
      doc: doc([{ id: "b-1", type: "hero" }]),
      expectedRevision: null,
    });
    const write = backend.writes.at(-1);
    expect(write?.table).toBe("page_translations");
    expect(write?.permissions).toEqual([]);
    expect(write?.via).toBe("elevated");
  });

  test("authorization runs before the elevated client is used", async () => {
    const backend = createFakeBackend({ tables: tablesWith() });
    const service = createPageService(backend, LINKS);
    await service
      .saveDraft(CAMPUS_ADMIN("Bergen", "2"), {
        pageId: "page-1",
        locale: "no",
        doc: doc(),
        expectedRevision: null,
      })
      .catch(() => undefined);
    // The refusal must happen before any elevation is requested.
    expect(backend.elevations).toHaveLength(0);
    expect(backend.writes).toHaveLength(0);
  });

  test("normalises meta.status to draft or published only", async () => {
    const backend = createFakeBackend({ tables: tablesWith() });
    const service = createPageService(backend, LINKS);
    const odd = doc();
    (odd.meta as unknown as Record<string, unknown>).status = "archived";
    await service.saveDraft(GLOBAL_ADMIN(), {
      pageId: "page-1",
      locale: "no",
      doc: odd,
      expectedRevision: null,
    });
    const write = backend.writes.at(-1);
    const saved = JSON.parse(String(write?.data?.draft_document)) as PageDoc;
    expect(saved.meta.status).toBe("draft");
  });
});

const COMMITTED_I_RE = /committed/i;
const RECOVERY_I_RE = /unpublish the locale|re-run/i;

describe("setPublished", () => {
  test("reports the locale that committed when the page row fails", async () => {
    // Two rows, two requests, no transaction across them. If the locale
    // update commits and the page update does not, the draft is public *now*
    // — certainly so when the page is already published through another
    // locale — while a plain error tells the caller nothing was written. No
    // compensating write is attempted, because it can fail the same way.
    const backend = createFakeBackend({
      tables: tablesWith(),
      onWrite: (_op, table) => {
        if (table === "pages") {
          throw new Error("page row update failed");
        }
      },
    });
    const service = createPageService(backend, LINKS);

    let thrown: unknown;
    try {
      await service.setPublished(GLOBAL_ADMIN(), {
        pageId: "page-1",
        locale: "no",
        published: true,
        expectedRevision: null,
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(DomainError);
    const failure = thrown as DomainError;
    expect(failure.message).toMatch(COMMITTED_I_RE);
    expect(failure.details.committed).toMatchObject({
      table: "page_translations",
      isPublished: true,
    });
    expect(failure.details.pageStatusUpdated).toBe(false);
    expect(failure.remedy).toMatch(RECOVERY_I_RE);
    // The locale really did commit — that is the whole point.
    expect(
      backend.writes.find((write) => write.table === "page_translations")?.data
        ?.is_published
    ).toBe(true);
  });

  test("copies the draft into the published document", async () => {
    const backend = createFakeBackend({ tables: tablesWith() });
    const service = createPageService(backend, LINKS);
    await service.setPublished(GLOBAL_ADMIN(), {
      pageId: "page-1",
      locale: "no",
      published: true,
      expectedRevision: null,
    });
    const translationWrite = backend.writes.find(
      (write) => write.table === "page_translations"
    );
    expect(translationWrite?.data?.is_published).toBe(true);
    expect(translationWrite?.data?.puck_document).toContain("b-1");
    // Publishing a public page grants read to anyone.
    expect(translationWrite?.permissions).toContain('read("any")');
  });

  test("refuses to publish a locale with no draft", async () => {
    const tables = tablesWith();
    (
      tables.pages[0].translation_refs as Record<string, unknown>[]
    )[0].draft_document = null;
    const backend = createFakeBackend({ tables });
    const service = createPageService(backend, LINKS);
    await expect(
      service.setPublished(GLOBAL_ADMIN(), {
        pageId: "page-1",
        locale: "no",
        published: true,
        expectedRevision: null,
      })
    ).rejects.toThrow(NO_NO_DRAFT_TO_PUBLISH_I_RE);
  });

  test("the OWNING department may publish its own page", async () => {
    // This matches `publishPageAction` in the admin app, which calls
    // `assertPublishAccess(ctx, ownership.campus, ownership.department)` —
    // passing the department, which permits the owning department member.
    // Omitting it would be the stricter campus-admin-only rule, and that is
    // deliberately NOT what the portal does for pages.
    const backend = createFakeBackend({ tables: tablesWith() });
    const service = createPageService(backend, LINKS);
    await expect(
      service.setPublished(DEPARTMENT_MEMBER("dept-a", "1"), {
        pageId: "page-1",
        locale: "no",
        published: true,
        expectedRevision: null,
      })
    ).resolves.toBeDefined();
  });

  test("a DIFFERENT department may not publish it", async () => {
    const backend = createFakeBackend({ tables: tablesWith() });
    const service = createPageService(backend, LINKS);
    await expect(
      service.setPublished(DEPARTMENT_MEMBER("dept-other", "1"), {
        pageId: "page-1",
        locale: "no",
        published: true,
        expectedRevision: null,
      })
    ).rejects.toThrow(NO_WRITE_ACCESS_TO_THIS_DEPARTMENT_I_RE);
    expect(backend.writes).toHaveLength(0);
  });

  test("another campus may not publish it", async () => {
    const backend = createFakeBackend({ tables: tablesWith() });
    const service = createPageService(backend, LINKS);
    await expect(
      service.setPublished(CAMPUS_ADMIN("Bergen", "2"), {
        pageId: "page-1",
        locale: "no",
        published: true,
        expectedRevision: null,
      })
    ).rejects.toThrow(DO_NOT_MANAGE_I_RE);
    expect(backend.writes).toHaveLength(0);
  });

  test("unpublishing removes the public read permission", async () => {
    const tables = tablesWith();
    (
      tables.pages[0].translation_refs as Record<string, unknown>[]
    )[0].is_published = true;
    const backend = createFakeBackend({ tables });
    const service = createPageService(backend, LINKS);
    await service.setPublished(GLOBAL_ADMIN(), {
      pageId: "page-1",
      locale: "no",
      published: false,
      expectedRevision: null,
    });
    const write = backend.writes.find(
      (entry) => entry.table === "page_translations"
    );
    expect(write?.data?.is_published).toBe(false);
    expect(write?.permissions).toEqual([]);
  });

  test("refuses a stale revision", async () => {
    const backend = createFakeBackend({ tables: tablesWith() });
    const service = createPageService(backend, LINKS);
    await expect(
      service.setPublished(GLOBAL_ADMIN(), {
        pageId: "page-1",
        locale: "no",
        published: true,
        expectedRevision: "1999-01-01T00:00:00.000Z",
      })
    ).rejects.toThrow(CHANGED_SINCE_IT_WAS_READ_I_RE);
  });
});

const NO_PUBLISHED_DOC_I_RE = /no published no document/i;
const NO_PAGE_FOUND_RE = /No page found/;

describe("draft visibility on a published page", () => {
  /**
   * The dangerous shape: the page row says `published`, so it is public — but
   * the translation carries a draft with unreleased edits on top of the
   * published document. `load()` prefers the draft, and `pages` has
   * `rowSecurity: false` with a table-level `read("any")`, so nothing in
   * Appwrite stops an out-of-scope caller reading it.
   */
  function publishedWithNewerDraft(): FakeTables {
    return tablesWith({
      pages: [
        {
          $id: "page-pub",
          $createdAt: "2026-01-01T00:00:00.000Z",
          $updatedAt: "2026-01-01T00:00:00.000Z",
          slug: "public-page",
          status: "published",
          visibility: "public",
          campus_id: "1",
          department_id: "dept-a",
          campus: { $id: "1" },
          department: { $id: "dept-a" },
          translation_refs: [
            {
              $id: "tr-pub",
              $updatedAt: "2026-01-01T00:00:00.000Z",
              locale: "no",
              title: "Public page",
              description: "Released",
              is_published: true,
              published_at: "2026-01-01T00:00:00.000Z",
              draft_document: JSON.stringify(
                doc([
                  { id: "secret", type: "text", body: "UNRELEASED PRICING" },
                ])
              ),
              puck_document: JSON.stringify(
                doc([{ id: "live", type: "text", body: "Released copy" }])
              ),
            },
          ],
        },
      ],
    });
  }

  test("the owning department sees the draft", async () => {
    const service = createPageService(
      createFakeBackend({ tables: publishedWithNewerDraft() }),
      LINKS
    );
    const view = await service.load(DEPARTMENT_MEMBER("dept-a", "1"), {
      pageId: "page-pub",
      locale: "no",
    });
    expect(view.documentSource).toBe("draft");
    expect(view.blocks.map((block) => block.id)).toEqual(["secret"]);
    expect(view.hasUnpublishedChanges).toBe(true);
  });

  test("another campus sees only the published document", async () => {
    const service = createPageService(
      createFakeBackend({ tables: publishedWithNewerDraft() }),
      LINKS
    );
    const view = await service.load(CAMPUS_ADMIN("Bergen", "2"), {
      pageId: "page-pub",
      locale: "no",
    });
    expect(view.documentSource).toBe("published");
    expect(view.blocks.map((block) => block.id)).toEqual(["live"]);
    expect(JSON.stringify(view)).not.toContain("UNRELEASED PRICING");
  });

  test("an out-of-scope caller is not told that unpublished edits exist", async () => {
    const service = createPageService(
      createFakeBackend({ tables: publishedWithNewerDraft() }),
      LINKS
    );
    const view = await service.load(CAMPUS_ADMIN("Bergen", "2"), {
      pageId: "page-pub",
      locale: "no",
    });
    expect(view.hasUnpublishedChanges).toBe(false);
  });

  test("a published page with no published document for the locale is not readable out of scope", async () => {
    const tables = publishedWithNewerDraft();
    const translations = (tables.pages as Record<string, unknown>[])[0]
      .translation_refs as Record<string, unknown>[];
    translations[0].puck_document = null;

    const service = createPageService(createFakeBackend({ tables }), LINKS);
    await expect(
      service.load(CAMPUS_ADMIN("Bergen", "2"), {
        pageId: "page-pub",
        locale: "no",
      })
    ).rejects.toThrow(NO_PUBLISHED_DOC_I_RE);
  });

  test("an unpublished page stays invisible out of scope", async () => {
    const service = createPageService(
      createFakeBackend({ tables: tablesWith() }),
      LINKS
    );
    await expect(
      service.load(CAMPUS_ADMIN("Bergen", "2"), {
        pageId: "page-1",
        locale: "no",
      })
    ).rejects.toThrow(NO_PAGE_FOUND_RE);
  });
});

describe("list pagination across the visibility filter", () => {
  /**
   * The shape that breaks naive paging: many out-of-scope drafts ahead of the
   * caller's own page. Appwrite applies limit/offset before the application
   * filter, so the first window contains nothing the caller may see.
   */
  function crowded(): FakeTables {
    const pages: FakeRow[] = [];
    for (let index = 0; index < 25; index += 1) {
      pages.push({
        $id: `bergen-draft-${index}`,
        $updatedAt: `2026-02-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
        slug: `bergen-${index}`,
        status: "draft",
        visibility: "public",
        campus_id: "2",
        department_id: "dept-b",
        campus: { $id: "2" },
        department: { $id: "dept-b" },
        translation_refs: [],
      });
    }
    pages.push({
      $id: "oslo-draft",
      $updatedAt: "2026-01-01T00:00:00.000Z",
      slug: "oslo-page",
      status: "draft",
      visibility: "public",
      campus_id: "1",
      department_id: "dept-a",
      campus: { $id: "1" },
      department: { $id: "dept-a" },
      translation_refs: [],
    });
    return { pages, page_translations: [] };
  }

  test("finds a visible page sitting behind a full window of invisible drafts", async () => {
    const service = createPageService(
      createFakeBackend({ tables: crowded() }),
      LINKS
    );
    const found = await service.list(CAMPUS_ADMIN("Oslo", "1"), {
      limit: 20,
      offset: 0,
    });

    // Ordering is `$updatedAt` descending, so the 25 Bergen drafts come first.
    // A single 20-row window would have returned nothing at all.
    expect(found.rows.map((row) => row.id)).toEqual(["oslo-draft"]);
    expect(found.nextOffset).toBeNull();
  });

  test("a full page reports a cursor, and following it does not repeat or skip", async () => {
    const tables = crowded();
    const service = createPageService(createFakeBackend({ tables }), LINKS);
    const principal = GLOBAL_ADMIN();

    const first = await service.list(principal, { limit: 10, offset: 0 });
    expect(first.rows).toHaveLength(10);
    expect(first.nextOffset).toBe(10);

    const second = await service.list(principal, {
      limit: 10,
      offset: first.nextOffset ?? 0,
    });
    expect(second.rows).toHaveLength(10);

    const firstIds = new Set(first.rows.map((row) => row.id));
    for (const row of second.rows) {
      expect(firstIds.has(row.id)).toBe(false);
    }

    const third = await service.list(principal, {
      limit: 10,
      offset: second.nextOffset ?? 0,
    });
    const all = [...first.rows, ...second.rows, ...third.rows].map(
      (row) => row.id
    );
    expect(new Set(all).size).toBe(26);
    expect(third.nextOffset).toBeNull();
  });

  test("walking the cursor to exhaustion yields every visible page exactly once", async () => {
    const service = createPageService(
      createFakeBackend({ tables: crowded() }),
      LINKS
    );
    const principal = CAMPUS_ADMIN("Oslo", "1");

    const seen: string[] = [];
    let offset = 0;
    let guard = 0;
    for (;;) {
      guard += 1;
      if (guard > 20) {
        throw new Error("cursor did not terminate");
      }
      const page = await service.list(principal, { limit: 5, offset });
      seen.push(...page.rows.map((row) => row.id));
      if (page.nextOffset === null) {
        break;
      }
      offset = page.nextOffset;
    }

    expect(seen).toEqual(["oslo-draft"]);
  });
});

describe("what a published-only viewer is told", () => {
  /**
   * `saveDraft` writes the draft's `meta.title`/`meta.description` into the
   * translation row's own columns while `is_published` stays true. A caller
   * limited to the published document therefore gets released blocks under an
   * unreleased headline unless the metadata comes from that document too.
   */
  function publishedWithRenamedDraft(): FakeTables {
    const published: PageDoc = {
      blocks: [{ id: "live", type: "text", body: "Released copy" }],
      meta: {
        accentColor: "#3DA9E0",
        department: "dept-a",
        slug: "public-page",
        status: "published",
        title: "Released title",
        description: "Released description",
      },
    };
    const draft: PageDoc = {
      blocks: [{ id: "secret", type: "text", body: "UNRELEASED" }],
      meta: {
        ...published.meta,
        title: "UNRELEASED TITLE",
        description: "UNRELEASED DESCRIPTION",
      },
    };
    return tablesWith({
      pages: [
        {
          $id: "page-pub",
          $createdAt: "2026-01-01T00:00:00.000Z",
          $updatedAt: "2026-01-01T00:00:00.000Z",
          slug: "public-page",
          status: "published",
          visibility: "public",
          campus_id: "1",
          department_id: "dept-a",
          campus: { $id: "1" },
          department: { $id: "dept-a" },
          translation_refs: [
            {
              $id: "tr-pub",
              $updatedAt: "2026-01-01T00:00:00.000Z",
              locale: "no",
              // The columns track the draft, which is the whole problem.
              title: "UNRELEASED TITLE",
              description: "UNRELEASED DESCRIPTION",
              is_published: true,
              published_at: "2026-01-01T00:00:00.000Z",
              draft_document: JSON.stringify(draft),
              puck_document: JSON.stringify(published),
            },
          ],
        },
      ],
    });
  }

  test("another campus reads the published title, not the draft's", async () => {
    const service = createPageService(
      createFakeBackend({ tables: publishedWithRenamedDraft() }),
      LINKS
    );
    const view = await service.load(CAMPUS_ADMIN("Bergen", "2"), {
      pageId: "page-pub",
      locale: "no",
    });

    expect(view.documentSource).toBe("published");
    expect(view.title).toBe("Released title");
    expect(view.description).toBe("Released description");
  });

  test("the owning campus still reads the draft's title", async () => {
    const service = createPageService(
      createFakeBackend({ tables: publishedWithRenamedDraft() }),
      LINKS
    );
    const view = await service.load(CAMPUS_ADMIN("Oslo", "1"), {
      pageId: "page-pub",
      locale: "no",
    });

    expect(view.documentSource).toBe("draft");
    expect(view.title).toBe("UNRELEASED TITLE");
  });
});

describe("an owner whose locale has no draft", () => {
  /**
   * A legacy row: only `puck_document`, never a draft. `documentSource` is
   * "published" for the owner too, so reading it as an authorization answer
   * locks the owner out of creating the draft.
   */
  function publishedOnly(): FakeTables {
    return tablesWith({
      pages: [
        {
          $id: "page-legacy",
          $createdAt: "2026-01-01T00:00:00.000Z",
          $updatedAt: "2026-01-01T00:00:00.000Z",
          slug: "legacy",
          status: "published",
          visibility: "public",
          campus_id: "1",
          department_id: "dept-a",
          campus: { $id: "1" },
          department: { $id: "dept-a" },
          translation_refs: [
            {
              $id: "tr-legacy",
              $updatedAt: "2026-01-01T00:00:00.000Z",
              locale: "no",
              title: "Legacy page",
              description: "Released",
              is_published: true,
              published_at: "2026-01-01T00:00:00.000Z",
              draft_document: null,
              puck_document: JSON.stringify(
                doc([{ id: "live", type: "text", body: "Released copy" }])
              ),
            },
          ],
        },
      ],
    });
  }

  test("is authorized for the draft even though there is none", async () => {
    const service = createPageService(
      createFakeBackend({ tables: publishedOnly() }),
      LINKS
    );
    const view = await service.load(DEPARTMENT_MEMBER("dept-a", "1"), {
      pageId: "page-legacy",
      locale: "no",
    });

    expect(view.documentSource).toBe("published");
    expect(view.canSeeDraft).toBe(true);
  });

  test("an out-of-scope caller is not authorized for the draft", async () => {
    const service = createPageService(
      createFakeBackend({ tables: publishedOnly() }),
      LINKS
    );
    const view = await service.load(CAMPUS_ADMIN("Bergen", "2"), {
      pageId: "page-legacy",
      locale: "no",
    });

    expect(view.documentSource).toBe("published");
    expect(view.canSeeDraft).toBe(false);
  });
});

describe("a prop path cannot escape the document", () => {
  /**
   * `setProp` walks the path with `node[key]`, which follows `__proto__` to the
   * real `Object.prototype`. `applyEdits` deep-copies through `JSON.parse`,
   * which does not help — the copy's prototype IS `Object.prototype`. And this
   * runs before the proposal gate, so it would land in propose-only mode with
   * no confirmation and no write.
   */
  const POLLUTED_KEY = "mcp_prototype_probe";

  function pageDoc(): PageDoc {
    return {
      blocks: [{ id: "b1", type: "text", props: {} }],
      meta: {
        accentColor: "#3DA9E0",
        department: "dept-a",
        slug: "p",
        status: "draft",
        title: "T",
      },
    };
  }

  test("__proto__ in a path is refused and pollutes nothing", () => {
    const service = createPageService(
      createFakeBackend({ tables: tablesWith() }),
      LINKS
    );
    try {
      const { outcomes } = service.applyEdits(pageDoc(), [
        {
          op: "set_prop",
          blockId: "b1",
          path: `__proto__.${POLLUTED_KEY}`,
          value: "PWNED",
        },
      ]);

      expect(outcomes[0]?.applied).toBe(false);
      expect(outcomes[0]?.detail).toContain("__proto__");
      expect(({} as Record<string, unknown>)[POLLUTED_KEY]).toBeUndefined();
    } finally {
      // Belt and braces: if the guard ever regresses, do not leave the rest of
      // the suite running against a polluted prototype.
      delete (Object.prototype as Record<string, unknown>)[POLLUTED_KEY];
    }
  });

  test("constructor and prototype are refused too", () => {
    const service = createPageService(
      createFakeBackend({ tables: tablesWith() }),
      LINKS
    );
    const { outcomes } = service.applyEdits(pageDoc(), [
      { op: "set_prop", blockId: "b1", path: "constructor.x", value: 1 },
      { op: "set_prop", blockId: "b1", path: "props.a.prototype.b", value: 1 },
    ]);

    expect(outcomes.map((outcome) => outcome.applied)).toEqual([false, false]);
  });

  test("an ordinary nested path still applies", () => {
    const service = createPageService(
      createFakeBackend({ tables: tablesWith() }),
      LINKS
    );
    const { doc, outcomes } = service.applyEdits(pageDoc(), [
      {
        op: "set_prop",
        blockId: "b1",
        path: "props.items.0.label",
        value: "Hi",
      },
    ]);

    expect(outcomes[0]?.applied).toBe(true);
    const block = doc.blocks[0] as unknown as {
      props: { items: Array<{ label: string }> };
    };
    expect(block.props.items[0]?.label).toBe("Hi");
  });
});

describe("publishing refuses a malformed draft", () => {
  function brokenDraft(): FakeTables {
    return tablesWith({
      pages: [
        {
          $id: "page-broken",
          $createdAt: "2026-01-01T00:00:00.000Z",
          $updatedAt: "2026-01-01T00:00:00.000Z",
          slug: "broken",
          status: "published",
          visibility: "public",
          campus_id: "1",
          department_id: "dept-a",
          campus: { $id: "1" },
          department: { $id: "dept-a" },
          translation_refs: [
            {
              $id: "tr-broken",
              $updatedAt: "2026-01-01T00:00:00.000Z",
              locale: "no",
              title: "Broken",
              description: "Released",
              is_published: true,
              published_at: "2026-01-01T00:00:00.000Z",
              draft_document: "{ not json",
              puck_document: JSON.stringify(
                doc([{ id: "live", type: "text" }])
              ),
            },
          ],
        },
      ],
    });
  }

  test("the released document is left alone", async () => {
    const backend = createFakeBackend({
      tables: brokenDraft(),
      hasElevated: true,
    });
    const service = createPageService(backend, LINKS);

    await expect(
      service.setPublished(GLOBAL_ADMIN(), {
        pageId: "page-broken",
        locale: "no",
        published: true,
        expectedRevision: null,
      })
    ).rejects.toThrow(MALFORMED_I_RE);

    expect(
      backend.writes.filter((write) => write.table !== "audit_logs")
    ).toHaveLength(0);
  });
});
