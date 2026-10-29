import { describe, expect, test } from "bun:test";
import { BULK_ARCHIVE_STAGE, movedIds, runBulkArchive } from "./bulk-actions";

describe("bulk archive", () => {
  test("moves the selection to rejected", () => {
    const calls: string[] = [];
    runBulkArchive((stage) => calls.push(stage));
    expect(calls).toEqual(["rejected"]);
    expect(BULK_ARCHIVE_STAGE).toBe("rejected");
  });

  test("only candidates whose move succeeded are offered drafts", () => {
    const results: PromiseSettledResult<unknown>[] = [
      { status: "fulfilled", value: 1 },
      { status: "rejected", reason: new Error("x") },
      { status: "fulfilled", value: 1 },
    ];
    expect(movedIds(["a", "b", "c"], results)).toEqual(["a", "c"]);
  });
});
