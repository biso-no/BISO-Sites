import {
  emptyQuickResponse,
  SEARCH_GROUPS,
} from "@repo/shared/search/response";
import { describe, expect, it } from "vitest";
import { winterResponse as resp } from "@/test/search-fixtures";
import {
  optionDomId,
  quickOptions,
  SHOW_ALL_OPTION_ID,
  searchHref,
} from "./quick-options";

const flatGroups = SEARCH_GROUPS.flatMap((group) =>
  resp.groups[group].map((item) => item.id)
);

describe("quickOptions", () => {
  it("lists the best match, then groups in order, then show all", () => {
    expect(quickOptions(resp, "winter").map((o) => o.id)).toEqual([
      resp.best!.id,
      ...flatGroups,
      "show-all",
    ]);
  });

  it("links each option to its page and show all to /search", () => {
    const list = quickOptions(resp, "winter");
    expect(list[0].href).toBe("/events/winter-games-2027");
    expect(list.at(-1)).toEqual({
      href: "/search?q=winter",
      id: SHOW_ALL_OPTION_ID,
    });
  });

  it("trims and encodes the query for show all", () => {
    expect(quickOptions(resp, " winter games ").at(-1)?.href).toBe(
      "/search?q=winter+games"
    );
  });

  it("has no options when nothing matched", () => {
    expect(quickOptions(emptyQuickResponse("x", "en"), "x")).toEqual([]);
  });

  it("works without a best match", () => {
    const ids = quickOptions({ ...resp, best: null }, "winter").map(
      (o) => o.id
    );
    expect(ids).toEqual([...flatGroups, "show-all"]);
  });

  it("is just the best match and show all for a single result", () => {
    const single = {
      ...emptyQuickResponse("winter", "en"),
      best: resp.best,
      counts: { ...resp.counts, event: 1 },
      total: 1,
    };
    expect(quickOptions(single, "winter").map((o) => o.id)).toEqual([
      resp.best!.id,
      "show-all",
    ]);
  });
});

describe("optionDomId", () => {
  it("scopes option ids by their listbox", () => {
    expect(optionDomId("header-search", "show-all")).toBe(
      "header-search-opt-show-all"
    );
    expect(optionDomId("a", "x")).not.toBe(optionDomId("b", "x"));
  });
});

describe("searchHref", () => {
  it("encodes the trimmed query", () => {
    expect(searchHref("  ski & fun ")).toBe("/search?q=ski+%26+fun");
  });
});
