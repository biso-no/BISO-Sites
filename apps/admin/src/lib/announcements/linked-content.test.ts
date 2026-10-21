import { describe, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));

const { normalizeLink, resolveLinkedContent } = await import(
  "./linked-content"
);

const ROWS: Record<string, Record<string, unknown>> = {
  n1: {
    $id: "n1",
    $createdAt: "2026-01-01T10:00:00.000Z",
    campus_id: "1",
    image: "img.png",
    status: "published",
  },
  e1: {
    $id: "e1",
    campus_id: "1",
    start_date: "2026-02-01T10:00:00.000Z",
    status: "published",
  },
  d1: { $id: "d1", status: "draft" },
};
const TABLE_OF: Record<string, string> = {
  n1: "news",
  e1: "events",
  d1: "news",
};

function fakeDb() {
  return {
    listRows: mock((_db: string, table: string, queries: string[]) => {
      if (table === "content_translations") {
        return {
          rows: [
            { locale: "en", title: "English" },
            { locale: "no", title: "Norsk" },
          ],
        };
      }
      const id = Object.keys(ROWS).find(
        (key) => TABLE_OF[key] === table && queries.join().includes(key)
      );
      return { rows: id ? [ROWS[id]] : [] };
    }),
  } as unknown as Parameters<typeof resolveLinkedContent>[0];
}

describe("resolveLinkedContent", () => {
  test("a published news link fills the columns", async () => {
    const result = await resolveLinkedContent(fakeDb(), {
      type: "news",
      id: "n1",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.columns.deep_link).toBe("biso://news?id=n1");
    expect(result.columns.content_type).toBe("news");
    expect(result.columns.event_id).toBeNull();
    expect(result.columns.image).toBe("img.png");
    const items = JSON.parse(result.columns.items ?? "[]");
    expect(items).toHaveLength(1);
    expect(Object.keys(items[0]).sort()).toEqual(
      [
        "campus_id",
        "date",
        "id",
        "image",
        "title_en",
        "title_no",
        "type",
      ].sort()
    );
    expect(items[0].title_no).toBe("Norsk");
  });

  test("an event link sets event_id", async () => {
    const result = await resolveLinkedContent(fakeDb(), {
      type: "event",
      id: "e1",
    });
    expect(result.ok && result.columns.event_id).toBe("e1");
  });

  test("a draft is refused", async () => {
    expect(
      await resolveLinkedContent(fakeDb(), { type: "news", id: "d1" })
    ).toEqual({ ok: false, error: "Only published content can be linked." });
  });

  test("a missing row is refused", async () => {
    expect(
      await resolveLinkedContent(fakeDb(), { type: "news", id: "nope" })
    ).toEqual({ ok: false, error: "That content no longer exists." });
  });

  test("a legacy event_id links as an event", () => {
    expect(normalizeLink({ event_id: "e1" })).toEqual({
      ok: true,
      link: { type: "event", id: "e1" },
    });
    expect(normalizeLink({})).toEqual({ ok: true, link: null });
  });

  test("a half-filled pair is an error", () => {
    const error = { ok: false, error: "Pick the content to link." };
    expect(normalizeLink({ content_type: "news", content_id: "" })).toEqual(
      error
    );
    expect(normalizeLink({ content_type: null, content_id: "n1" })).toEqual(
      error
    );
  });

  test("explicit nulls unlink even with a stale event_id", () => {
    expect(
      normalizeLink({ content_type: null, content_id: null, event_id: "e1" })
    ).toEqual({ ok: true, link: null });
  });

  test("unlinking clears all six columns", async () => {
    expect(await resolveLinkedContent(fakeDb(), null)).toEqual({
      ok: true,
      columns: {
        content_id: null,
        content_type: null,
        deep_link: null,
        event_id: null,
        image: null,
        items: null,
      },
    });
  });
});
