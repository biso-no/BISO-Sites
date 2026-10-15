import { describe, expect, it } from "vitest";
import { resolveDocumentsFilters } from "./documents-filters";

describe("resolveDocumentsFilters", () => {
  it("lets a link open the page on one category", () => {
    // The bylaws page and the About section link straight to their
    // category; the filter used to be client-only state.
    expect(resolveDocumentsFilters({ category: "campus-bylaws" }, "1")).toEqual(
      { campusId: "1", category: "campus-bylaws" }
    );
  });

  it("ignores a category that does not exist", () => {
    expect(
      resolveDocumentsFilters({ category: "minutes" }, null).category
    ).toBe("all");
  });

  it("prefers the campus in the link over the visitor's selected campus", () => {
    expect(resolveDocumentsFilters({ campus: "2" }, "1").campusId).toBe("2");
    expect(resolveDocumentsFilters({ campus: "all" }, "1").campusId).toBeNull();
    expect(resolveDocumentsFilters({}, "1").campusId).toBe("1");
  });

  it("takes the first value when a parameter is repeated", () => {
    expect(
      resolveDocumentsFilters({ category: ["code-of-conduct", "x"] }, null)
        .category
    ).toBe("code-of-conduct");
  });
});
