import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { codeOnly } from "@/test/source";

const read = (f: string) =>
  codeOnly(readFileSync(join(import.meta.dirname, f), "utf8"));
const chips = read("filter-chips.tsx");
const header = read("page-header.tsx");
const grid = read("card-grid.tsx");
const person = read("person-card.tsx");

describe("navigation primitives (RD-012)", () => {
  it("builds filters from links, not state", () => {
    // State-based filters cannot be linked, shared, bookmarked, opened in a new
    // tab, or reached by the back button — and force the whole list to be a
    // client component. Phase 0 found four list clients doing exactly that.
    expect(chips).toContain("<Link");
    expect(chips).not.toContain("useState");
    expect(chips).not.toContain('"use client"');
    expect(chips).not.toContain("onClick");
  });

  it("preserves unrelated query parameters when a filter changes", () => {
    // Picking a category while ?campus=oslo is set must not drop the campus.
    // This is the prerequisite for RD-016's campus routing.
    expect(chips).toContain(
      "for (const [key, raw] of Object.entries(searchParams))"
    );
    expect(chips).toContain("if (key === param || raw === undefined)");
  });

  it("clears the parameter for the default option", () => {
    // One canonical URL for the unfiltered view, not both "/" and "?x=all".
    expect(chips).toContain("if (value !== defaultValue)");
  });

  it("marks the active filter for assistive technology", () => {
    // Colour alone does not convey which filter is applied.
    expect(chips).toContain('aria-current={isActive ? "true" : undefined}');
  });

  it("makes the page title the h1", () => {
    // Phase 0 could not settle h1 coverage statically because headings were
    // composed through hero components. Routing pages through PageHeader makes
    // the answer structural.
    expect(header).toContain("<h1");
    expect(header).toContain("type-display-lg");
  });

  it("marks up breadcrumbs as a labelled ordered list", () => {
    expect(header).toContain('aria-label="Breadcrumb"');
    expect(header).toContain("<ol");
    expect(header).toContain('aria-current={isLast ? "page" : undefined}');
  });

  it("reflows the grid 1 to 2 to 3", () => {
    expect(grid).toContain("grid-cols-1");
    expect(grid).toContain("sm:grid-cols-2 lg:grid-cols-3");
  });

  it("omits the person email action when there is no address", () => {
    // PLACEHOLDER-007: DepartmentBoard has name/role/imageUrl but no email.
    // A dead mail icon is worse than none.
    expect(person).toContain("{email ? (");
  });

  it("does not name a person's job title `role`", () => {
    // `role` shadows the ARIA attribute; `role="Campus Director"` trips both
    // linters and readers.
    expect(person).toContain("position?: string | null");
    expect(person).not.toContain("role?: string | null");
  });
});
