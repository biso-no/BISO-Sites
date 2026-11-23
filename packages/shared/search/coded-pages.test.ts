import { describe, expect, it } from "vitest";
import { CODED_PAGES, codedPageEntries, codedRowId } from "./coded-pages";

describe("coded pages", () => {
  it("lists each path once with a title in both languages", () => {
    expect(new Set(CODED_PAGES.map((p) => p.path)).size).toBe(
      CODED_PAGES.length
    );
    for (const p of CODED_PAGES) {
      expect(p.text.no.title).not.toBe("");
      expect(p.text.en.title).not.toBe("");
    }
  });

  it("carries the keywords people type", () => {
    const keywords = (path: string, locale: "no" | "en") =>
      CODED_PAGES.find((p) => p.path === path)?.text[locale].keywords;
    expect(keywords("/varsling", "no")).toContain("varsling");
    expect(keywords("/varsling", "en")).toContain("whistleblowing");
    expect(keywords("/membership", "no")).toContain("medlemskap");
    expect(keywords("/membership", "en")).toContain("membership");
    expect(keywords("/documents", "no")).toContain("vedtekter");
    expect(keywords("/documents", "en")).toContain("statutes");
    expect(keywords("/okonomisk-stotte", "no")).toContain("støtte");
    expect(keywords("/okonomisk-stotte", "en")).toContain("funding");
  });

  it("builds row ids from paths", () => {
    expect(codedRowId("/")).toBe("home");
    expect(codedRowId("/campus/bergen")).toBe("campus-bergen");
  });

  it("drops skipped paths", () => {
    const entries = codedPageEntries(
      { syncedAt: 1 },
      new Set(["/projects/winter-games"])
    );
    expect(entries.some((e) => e.url === "/projects/winter-games")).toBe(false);
  });

  it("scopes campus landing pages to their campus", () => {
    const entries = codedPageEntries({ syncedAt: 1 });
    expect(entries.find((e) => e.url === "/campus/bergen")?.campus_id).toBe(
      "2"
    );
    expect(entries.find((e) => e.url === "/campus/national")?.campus_id).toBe(
      "all"
    );
    expect(entries.find((e) => e.url === "/about")?.campus_id).toBe("all");
  });

  it("makes one entry per locale with the coded shape", () => {
    const entries = codedPageEntries({ syncedAt: 7 }).filter(
      (e) => e.url === "/safety"
    );
    expect(entries.map((e) => e.locale).sort()).toEqual(["en", "no"]);
    for (const e of entries) {
      expect(e.type).toBe("coded");
      expect(e.text_locale).toBe(e.locale);
      expect(e.body).toBe(e.summary);
      expect(e.visible_until).toBe(32_503_680_000);
      expect(e.synced_at).toBe(7);
    }
  });
});
