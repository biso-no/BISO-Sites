import { describe, expect, it, mock } from "bun:test";
import { withDraftTitles } from "./page-draft-titles";

function fakeDb(drafts: { $id: string; title: string | null }[]) {
  const listRows = mock((_database: string, _table: string) =>
    Promise.resolve({ rows: drafts })
  );
  return { db: { listRows }, listRows };
}

const pages = [
  {
    $id: "p1",
    translation_refs: [
      { $id: "t-no", locale: "no", title: "Publisert" },
      { $id: "t-en", locale: "en", title: "Published" },
    ],
  },
  { $id: "p2", translation_refs: [] },
];

describe("withDraftTitles", () => {
  it("shows the draft title where a draft exists and the published one otherwise", async () => {
    const { db, listRows } = fakeDb([{ $id: "t-no", title: "Utkast" }]);

    const result = await withDraftTitles(db, pages);

    expect(listRows.mock.calls[0]?.[1]).toBe("page_drafts");
    expect(result[0]?.translation_refs).toEqual([
      { $id: "t-no", locale: "no", title: "Utkast" },
      { $id: "t-en", locale: "en", title: "Published" },
    ]);
    expect(result[1]).toEqual(pages[1]);
  });

  it("keeps the published title for a draft with an empty title", async () => {
    const { db } = fakeDb([{ $id: "t-no", title: "" }]);
    const result = await withDraftTitles(db, pages);
    expect(result[0]?.translation_refs?.[0]?.title).toBe("Publisert");
  });

  it("does not read drafts when there are no pages", async () => {
    const { db, listRows } = fakeDb([]);
    expect(await withDraftTitles(db, [])).toEqual([]);
    expect(listRows).not.toHaveBeenCalled();
  });
});
