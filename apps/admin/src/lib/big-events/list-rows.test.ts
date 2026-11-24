import { describe, expect, mock, test } from "bun:test";
import { Query } from "@repo/api";
import { listAllRows, listRowsByIds, type RowReader } from "./list-rows";

function makeDb(pages: { $id: string }[][]) {
  const listRows = mock(async () => ({ rows: [] as { $id: string }[] }));
  for (const page of pages) {
    listRows.mockImplementationOnce(async () => ({ rows: page }));
  }
  return { listRows, reader: { listRows } as unknown as RowReader };
}

const ids = (from: number, count: number) =>
  Array.from({ length: count }, (_, index) => ({ $id: `r${from + index}` }));

describe("listAllRows", () => {
  test("reads page after page until a short page", async () => {
    const db = makeDb([ids(0, 100), ids(100, 5)]);

    const result = await listAllRows(db.reader, "big_event_participants", [
      Query.equal("big_event_id", ["b1"]),
    ]);

    expect(result).toHaveLength(105);
    const calls = db.listRows.mock.calls as unknown as [
      string,
      string,
      string[],
    ][];
    expect(calls).toHaveLength(2);
    expect(calls[0]?.[2]).toContain(Query.limit(100));
    expect(calls[0]?.[2]).toContain(Query.equal("big_event_id", ["b1"]));
    expect(calls[1]?.[2]).toContain(Query.cursorAfter("r99"));
  });
});

describe("listRowsByIds", () => {
  test("asks for at most 100 ids at a time", async () => {
    const db = makeDb([ids(0, 100), ids(100, 20)]);
    const wanted = Array.from({ length: 120 }, (_, index) => `r${index}`);

    const result = await listRowsByIds(db.reader, "user", "$id", wanted, []);

    expect(result).toHaveLength(120);
    const calls = db.listRows.mock.calls as unknown as [
      string,
      string,
      string[],
    ][];
    expect(calls[0]?.[2]).toContain(Query.equal("$id", wanted.slice(0, 100)));
    expect(calls[1]?.[2]).toContain(Query.equal("$id", wanted.slice(100)));
  });

  test("asks nothing for an empty list", async () => {
    const db = makeDb([]);
    expect(await listRowsByIds(db.reader, "user", "$id", [], [])).toEqual([]);
    expect(db.listRows).not.toHaveBeenCalled();
  });
});
