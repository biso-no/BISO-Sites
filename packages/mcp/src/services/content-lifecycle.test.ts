/**
 * Lifecycle writes and translation ACLs.
 *
 * A content row's `content_translations` children carry their own permissions,
 * and every `apps/admin` content action rebuilds them from the status on each
 * write. A lifecycle change that updates only the parent leaves those children
 * describing the previous status.
 *
 * On today's schema that is latent rather than live: `content_translations`
 * grants `read("any")` at table level, and with row security the two are a
 * union, so no row ACL currently hides or reveals anything. The tests below pin
 * the write so that content published through this package is identical to
 * content published through the portal — which is what makes tightening that
 * table grant a schema change rather than a data migration.
 */

import { describe, expect, test } from "bun:test";
import { createFakeBackend, GLOBAL_ADMIN } from "../testing/index";
import { createContentService } from "./content";

const LINKS = {
  web: (path: string) => `https://biso.no${path}`,
  admin: (path: string) => `https://admin.biso.no${path}`,
};

function tables() {
  return {
    news: [
      {
        $id: "news-1",
        $updatedAt: "2026-01-01T00:00:00.000Z",
        slug: "a-story",
        status: "draft",
        campus_id: "1",
        department_id: "dept-a",
      },
    ],
    content_translations: [
      {
        $id: "tr-no",
        content_id: "news-1",
        content_type: "news",
        locale: "no",
        title: "En sak",
      },
      {
        $id: "tr-en",
        content_id: "news-1",
        content_type: "news",
        locale: "en",
        title: "A story",
      },
      {
        // Belongs to a different row entirely; must never be touched.
        $id: "tr-other",
        content_id: "news-2",
        content_type: "news",
        locale: "no",
        title: "Another story",
      },
    ],
  };
}

function service(backend = createFakeBackend({ tables: tables() })) {
  return { service: createContentService(backend, LINKS), backend };
}

describe("setStatus keeps translation ACLs in step", () => {
  test("publishing grants public read on every translation of that row", async () => {
    const { service: content, backend } = service();
    await content.setStatus(
      GLOBAL_ADMIN(),
      "news",
      "news-1",
      "published",
      null
    );

    const translationWrites = backend.writes.filter(
      (write) => write.table === "content_translations"
    );
    expect(translationWrites.map((write) => write.id).sort()).toEqual([
      "tr-en",
      "tr-no",
    ]);
    for (const write of translationWrites) {
      expect(write.permissions).toEqual(['read("any")']);
    }
  });

  test("unpublishing clears them again", async () => {
    const { service: content, backend } = service();
    await content.setStatus(GLOBAL_ADMIN(), "news", "news-1", "draft", null);

    const translationWrites = backend.writes.filter(
      (write) => write.table === "content_translations"
    );
    expect(translationWrites).toHaveLength(2);
    for (const write of translationWrites) {
      expect(write.permissions).toEqual([]);
    }
  });

  test("another row's translations are left alone", async () => {
    const { service: content, backend } = service();
    await content.setStatus(
      GLOBAL_ADMIN(),
      "news",
      "news-1",
      "published",
      null
    );

    expect(backend.writes.some((write) => write.id === "tr-other")).toBe(false);
  });

  test("publishing widens the translations before the parent", async () => {
    // No transaction spans these writes. Widening the children first means a
    // failure leaves the row unpublished, which is the safe direction.
    const { service: content, backend } = service();
    await content.setStatus(
      GLOBAL_ADMIN(),
      "news",
      "news-1",
      "published",
      null
    );

    const order = backend.writes.map((write) => write.table);
    expect(order.indexOf("content_translations")).toBeLessThan(
      order.indexOf("news")
    );
  });

  test("unpublishing narrows the parent before the translations", async () => {
    const { service: content, backend } = service();
    await content.setStatus(GLOBAL_ADMIN(), "news", "news-1", "draft", null);

    const order = backend.writes.map((write) => write.table);
    expect(order.indexOf("news")).toBeLessThan(
      order.indexOf("content_translations")
    );
  });

  test("a members-only row publishes to the members team, not to anyone", async () => {
    const backend = createFakeBackend({
      tables: {
        ...tables(),
        news: [
          {
            $id: "news-1",
            $updatedAt: "2026-01-01T00:00:00.000Z",
            slug: "a-story",
            status: "draft",
            campus_id: "1",
            department_id: "dept-a",
            member_only: true,
          },
        ],
      },
    });
    const { service: content } = service(backend);
    await content.setStatus(
      GLOBAL_ADMIN(),
      "news",
      "news-1",
      "published",
      null
    );

    for (const write of backend.writes) {
      expect(write.permissions).toEqual(['read("team:biso-members")']);
    }
  });
});
