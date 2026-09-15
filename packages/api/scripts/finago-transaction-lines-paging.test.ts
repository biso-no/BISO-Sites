import { describe, expect, it } from "vitest";
import {
  collectAllTransactionLines,
  pagingRefusalMessage,
  parseNextLinkUrl,
  transactionLinesSearchWindow,
} from "./finago-transaction-lines-paging";

describe("parseNextLinkUrl", () => {
  it("returns null when there is no link header", () => {
    expect(parseNextLinkUrl(null)).toBeNull();
  });

  it("extracts the next relation's url among several relations", () => {
    const header =
      '<https://rest.api.24sevenoffice.com/v1/transactionlines?page=1>; rel="first", <https://rest.api.24sevenoffice.com/v1/transactionlines?page=1>; rel="prev", <https://rest.api.24sevenoffice.com/v1/transactionlines?page=3>; rel="next"';
    expect(parseNextLinkUrl(header)).toBe(
      "https://rest.api.24sevenoffice.com/v1/transactionlines?page=3"
    );
  });

  it("returns null when there is no next relation", () => {
    const header =
      '<https://rest.api.24sevenoffice.com/v1/transactionlines?page=1>; rel="first"';
    expect(parseNextLinkUrl(header)).toBeNull();
  });
});

describe("collectAllTransactionLines", () => {
  it("returns the lines from a single page", async () => {
    const result = await collectAllTransactionLines(
      "https://x/page1",
      (url) => {
        expect(url).toBe("https://x/page1");
        return Promise.resolve({
          lines: [{ id: "a" }],
          nextUrl: null,
          ok: true,
        });
      }
    );

    expect(result).toEqual({ lines: [{ id: "a" }], ok: true });
  });

  it("follows every page until there is no next url", async () => {
    const calls: string[] = [];
    const pages: Record<string, { lines: unknown[]; nextUrl: string | null }> =
      {
        "https://x/page1": { lines: [{ id: "a" }], nextUrl: "https://x/page2" },
        "https://x/page2": { lines: [{ id: "b" }], nextUrl: "https://x/page3" },
        "https://x/page3": { lines: [{ id: "c" }], nextUrl: null },
      };

    const result = await collectAllTransactionLines(
      "https://x/page1",
      (url) => {
        calls.push(url);
        return Promise.resolve({ ...pages[url], ok: true });
      }
    );

    expect(calls).toEqual([
      "https://x/page1",
      "https://x/page2",
      "https://x/page3",
    ]);
    expect(result).toEqual({
      lines: [{ id: "a" }, { id: "b" }, { id: "c" }],
      ok: true,
    });
  });

  it("finds a match that only appears on a later page", async () => {
    const pages: Record<string, { lines: unknown[]; nextUrl: string | null }> =
      {
        "https://x/page1": {
          lines: [{ id: "unrelated" }],
          nextUrl: "https://x/page2",
        },
        "https://x/page2": { lines: [{ id: "order-123" }], nextUrl: null },
      };

    const result = await collectAllTransactionLines("https://x/page1", (url) =>
      Promise.resolve({ ...pages[url], ok: true })
    );

    expect(result.ok).toBe(true);
    expect(result.lines).toContainEqual({ id: "order-123" });
  });

  it("fails closed and returns no lines when a later page fails", async () => {
    const result = await collectAllTransactionLines(
      "https://x/page1",
      (url) => {
        if (url === "https://x/page1") {
          return Promise.resolve({
            lines: [{ id: "a" }],
            nextUrl: "https://x/page2",
            ok: true,
          });
        }
        return Promise.resolve({ lines: [], nextUrl: null, ok: false });
      }
    );

    expect(result.ok).toBe(false);
    expect(result.lines).toEqual([]);
    expect(result.reason).toContain("page 2");
  });

  it("fails closed when pagination does not terminate", async () => {
    let page = 0;
    const result = await collectAllTransactionLines("https://x/page1", () => {
      page += 1;
      return Promise.resolve({
        lines: [],
        nextUrl: `https://x/page${page + 1}`,
        ok: true,
      });
    });

    expect(result.ok).toBe(false);
    expect(result.lines).toEqual([]);
    expect(result.reason).toContain("Exceeded");
    expect(result.pageCapReached).toBe(true);
  });

  it("does not flag a page failure as reaching the page cap", async () => {
    const result = await collectAllTransactionLines("https://x/page1", () =>
      Promise.resolve({ lines: [], nextUrl: null, ok: false })
    );

    expect(result.pageCapReached).toBeUndefined();
  });
});

describe("transactionLinesSearchWindow", () => {
  it("starts a day before the order was created", () => {
    const window = transactionLinesSearchWindow(
      "2026-09-09T10:00:00.000Z",
      new Date("2026-09-10T10:00:00.000Z")
    );
    expect(window.dateFrom).toBe("2026-09-08");
  });

  it("reaches through today even when the order was created long ago", () => {
    // A voucher is dated when it is posted, which can be weeks after the
    // order was created (e.g. while posting waited for a config fix).
    const window = transactionLinesSearchWindow(
      "2026-06-01T10:00:00.000Z",
      new Date("2026-09-15T10:00:00.000Z")
    );
    expect(window).toEqual({ dateFrom: "2026-05-31", dateTo: "2026-09-16" });
  });

  it("uses today's date in Oslo, not UTC, for the exclusive end", () => {
    // 23:30 UTC on 14 Sep is already 01:30 on 15 Sep in Oslo.
    const window = transactionLinesSearchWindow(
      "2026-09-01T10:00:00.000Z",
      new Date("2026-09-14T23:30:00.000Z")
    );
    expect(window.dateTo).toBe("2026-09-16");
  });

  it("crosses a month boundary", () => {
    const window = transactionLinesSearchWindow(
      "2026-09-01T00:30:00.000Z",
      new Date("2026-09-30T12:00:00.000Z")
    );
    expect(window).toEqual({ dateFrom: "2026-08-31", dateTo: "2026-10-01" });
  });
});

describe("pagingRefusalMessage", () => {
  it("says the range was too large and to check Finago by hand when the page cap is hit", () => {
    const message = pagingRefusalMessage(
      { lines: [], ok: false, pageCapReached: true, reason: "Exceeded 50" },
      { dateFrom: "2026-05-31", dateTo: "2026-09-16" }
    );
    expect(message).toContain("2026-05-31");
    expect(message).toContain("too large");
    expect(message).toContain("manually");
  });

  it("reports a plain read failure otherwise", () => {
    const message = pagingRefusalMessage(
      { lines: [], ok: false, reason: "Failed to fetch page 2." },
      { dateFrom: "2026-09-08", dateTo: "2026-09-16" }
    );
    expect(message).toContain("Failed to fetch page 2.");
    expect(message).not.toContain("too large");
  });
});
