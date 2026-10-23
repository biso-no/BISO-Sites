import { describe, expect, test } from "bun:test";
import { externalLinkProps, safeHref } from "./links";

describe("safeHref", () => {
  test("rejects script, data and blank hrefs", () => {
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("  JavaScript:x")).toBeNull();
    expect(safeHref("java\tscript:x")).toBeNull();
    expect(safeHref("\u0001javascript:x")).toBeNull();
    expect(safeHref("data:text/html,<b>x</b>")).toBeNull();
    expect(safeHref("")).toBeNull();
    expect(safeHref("   ")).toBeNull();
    expect(safeHref(undefined)).toBeNull();
  });

  test("keeps relative, http(s), mailto and tel hrefs", () => {
    for (const href of [
      "/om-oss",
      "#aftermovie",
      "?a=1",
      "./x",
      "https://x.no",
      "http://x.no",
      "mailto:a@b.no",
      "tel:123",
    ]) {
      expect(safeHref(href)).toBe(href);
    }
  });
});

describe("externalLinkProps", () => {
  test("only http(s) links open in a new tab", () => {
    expect(externalLinkProps("https://x.no")).toEqual({
      rel: "noopener",
      target: "_blank",
    });
    expect(externalLinkProps("/om-oss")).toEqual({});
    expect(externalLinkProps("mailto:a@b.no")).toEqual({});
  });
});
