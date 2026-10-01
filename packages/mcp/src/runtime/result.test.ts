/**
 * Pagination.
 *
 * The invariant these tests exist for is not "the numbers are right" — it is
 * that a cursor always moves. A client is told to follow `nextCursor` until it
 * is null, so a cursor that comes back equal to the one just used is not a
 * cosmetic error: it is a loop the caller has no way to detect.
 */

import { describe, expect, test } from "bun:test";
import { buildPagination, decodeCursor } from "./result";

const LIMIT = 20;

describe("buildPagination", () => {
  test("a full page advances the cursor", () => {
    const page = buildPagination({
      count: LIMIT,
      total: 900,
      offset: 0,
      limit: LIMIT,
    });
    expect(page.hasMore).toBe(true);
    expect(decodeCursor(page.nextCursor ?? undefined)).toBe(LIMIT);
  });

  test("a page that returned nothing offers no cursor at all", () => {
    // `consumed` is still `offset` here, so any cursor built from it is the
    // one the caller just followed.
    const page = buildPagination({
      count: 0,
      total: 900,
      offset: 5,
      limit: LIMIT,
    });
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
  });

  test("an unknown total still infers more from a full page", () => {
    const known = buildPagination({
      count: LIMIT,
      total: null,
      offset: 0,
      limit: LIMIT,
    });
    expect(known.hasMore).toBe(true);
    const short = buildPagination({
      count: 3,
      total: null,
      offset: 0,
      limit: LIMIT,
    });
    expect(short.hasMore).toBe(false);
  });

  test("walking the cursor terminates even when total counts the whole table", () => {
    // Whether `listRows(...).total` reports the filtered result or the size of
    // the whole table is unsettled on this Appwrite release (roadmap 3.5).
    // This walks the pessimistic reading: five rows match, nine hundred exist.
    // Under it, `consumed < total` stays true for every page after the last
    // matching row, and only the empty-page guard ends the walk.
    const MATCHING = 5;
    const WHOLE_TABLE = 900;

    const pageSizes: number[] = [];
    let offset = 0;
    let guard = 0;
    for (;;) {
      guard += 1;
      if (guard > 10) {
        throw new Error("cursor did not terminate");
      }
      const count = Math.max(0, Math.min(LIMIT, MATCHING - offset));
      pageSizes.push(count);
      const page = buildPagination({
        count,
        total: WHOLE_TABLE,
        offset,
        limit: LIMIT,
      });
      if (!page.hasMore) {
        break;
      }
      const next = decodeCursor(page.nextCursor ?? undefined);
      // The invariant. A cursor that does not move is the loop.
      expect(next).toBeGreaterThan(offset);
      offset = next;
    }

    expect(pageSizes).toEqual([MATCHING, 0]);
  });
});
