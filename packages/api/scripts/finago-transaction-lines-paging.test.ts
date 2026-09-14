import { describe, expect, it } from "vitest";
import {
  collectAllTransactionLines,
  parseNextLinkUrl,
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
  });
});
