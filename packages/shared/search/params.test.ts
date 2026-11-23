import { describe, expect, it } from "vitest";
import { parseSearchParams } from "./params";
import { groupOf, typesOf } from "./response";

const p = (s: string) => parseSearchParams(new URLSearchParams(s));

describe("parseSearchParams", () => {
  it("applies defaults and normalises q", () => {
    expect(p("q=  winter   games ")).toMatchObject({
      q: "winter games",
      locale: "no",
      campus: null,
      onlyCampus: false,
      group: null,
      page: 1,
      mode: "quick",
    });
  });

  it("caps q at 100 characters", () => {
    expect(p(`q=${"a".repeat(5000)}`).q.length).toBe(100);
  });

  it("reads every parameter", () => {
    expect(
      p("q=x&locale=en&campus=2&only_campus=1&type=job&page=3&mode=page")
    ).toMatchObject({
      locale: "en",
      campus: "2",
      onlyCampus: true,
      group: "job",
      page: 3,
      mode: "page",
    });
    expect(p("q=x&only_campus=true").onlyCampus).toBe(true);
  });

  it("falls back on malformed values", () => {
    expect(p("q=x&locale=de&campus=5&type=foo&page=-3")).toMatchObject({
      locale: "no",
      campus: null,
      group: null,
      page: 1,
    });
    expect(p("q=x&page=abc").page).toBe(1);
    expect(p("q=x&campus=").campus).toBeNull();
    expect(p("").q).toBe("");
  });

  it("caps page at 50", () => {
    expect(p("q=x&page=9999").page).toBe(50);
  });
});

describe("groups", () => {
  it("maps types to groups and back", () => {
    expect(groupOf("coded")).toBe("page");
    expect(groupOf("event")).toBe("event");
    expect(typesOf("page").sort()).toEqual(["coded", "document", "page"]);
    expect(typesOf("job")).toEqual(["job"]);
  });
});
