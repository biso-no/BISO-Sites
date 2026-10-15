import { describe, expect, it } from "vitest";
import {
  campusProjectNavLinks,
  careerDaysHrefs,
  findUnitHref,
  projectHubUnits,
  projectLinkLabel,
  visibleProjectLinks,
} from "./project-unit-links";

const unit = (name: string, campusId: string, href: string) => ({
  campusId,
  href,
  name,
});

const UNITS = [
  unit("Karrieredagene", "1", "/units/oslo/karrieredagene"),
  unit("Karrieredagene", "4", "/units/stavanger/karrieredagene"),
  unit(
    "Karrieredagene Marketing",
    "2",
    "/units/bergen/karrieredagene-marketing"
  ),
  unit("Bergensbaneløpet", "1", "/units/oslo/bergensbanelopet"),
  unit("Case Club", "2", "/units/bergen/case-club"),
];

describe("findUnitHref", () => {
  it("finds a unit by its display name, ignoring case", () => {
    expect(findUnitHref(UNITS, "bergensbaneløpet")).toBe(
      "/units/oslo/bergensbanelopet"
    );
  });

  it("keeps to the requested campus", () => {
    expect(findUnitHref(UNITS, "Karrieredagene", "4")).toBe(
      "/units/stavanger/karrieredagene"
    );
  });

  it("does not mistake a sub-unit for the unit itself", () => {
    // Bergen has only "Karrieredagene Marketing"; linking the Bergen career
    // days card there would send companies to the wrong team.
    expect(findUnitHref(UNITS, "Karrieredagene", "2")).toBeNull();
  });

  it("returns null when no unit matches", () => {
    expect(findUnitHref(UNITS, "No Such Unit")).toBeNull();
    expect(findUnitHref([], "Karrieredagene", "1")).toBeNull();
  });
});

describe("projectHubUnits", () => {
  it("collects the unit that runs the project on each campus, in campus order", () => {
    const units = [
      { campusId: "4", name: "Fadderullan", slug: "fadderullan" },
      { campusId: "1", name: "Fadderullan", slug: "fadderullan" },
      { campusId: "2", name: "Fadderullan Crew", slug: "fadderullan-crew" },
      { campusId: "2", name: "Fadderullan", slug: "fadderullan" },
    ];
    expect(
      projectHubUnits(units, "fadderullan").map((unit) => unit.campusId)
    ).toEqual(["1", "2", "4"]);
  });

  it("maps the Winter Games hub to the national Wintergames unit", () => {
    const units = [{ campusId: "5", name: "Wintergames", slug: "wintergames" }];
    expect(projectHubUnits(units, "winter-games")).toHaveLength(1);
  });

  it("is empty when no unit runs the project", () => {
    expect(projectHubUnits([], "karrieredagene")).toEqual([]);
  });
});

const menuUnit = (
  id: string,
  name: string,
  campusId: string,
  slug: string | null,
  category: "project" | "society" | null = null
) => ({
  campusId,
  campusLabel:
    { "1": "Oslo", "2": "Bergen", "5": "National" }[campusId] ?? null,
  category,
  href: `/units/${campusId}/${slug ?? id}`,
  id,
  name,
  slug,
});

const MENU_UNITS = [
  menuUnit("24", "Fadderullan", "1", "fadderullan", "project"),
  menuUnit("21", "Bergensbaneløpet", "1", "bergensbanelopet", "project"),
  menuUnit("22", "Charity", "1", "charity", "project"),
  menuUnit("317", "Fadderullan", "2", "fadderullan"),
  menuUnit("316", "Charity", "2", "charity", "project"),
  // Trondheim's Charity has neither a category nor a hub, so the menu
  // cannot tell it is a project. Setting its type in admin is the fix.
  menuUnit("614", "Charity", "3", "charity"),
  menuUnit("1007", "Wintergames", "5", "wintergames"),
  menuUnit("99", "Case Club", "2", "case-club", "society"),
];

describe("campusProjectNavLinks", () => {
  it("keeps project units only, with their campus", () => {
    const links = campusProjectNavLinks(MENU_UNITS);
    expect(links.map((link) => link.id)).not.toContain("99");
    expect(links.find((link) => link.id === "21")).toEqual({
      campusId: "1",
      campusLabel: "Oslo",
      hasHub: true,
      href: "/units/1/bergensbanelopet",
      id: "21",
      label: "Bergensbaneløpet",
    });
  });

  it("recognises a project unit by slug when its category is missing", () => {
    // Bergen's Charity is categorised, Fadderullan there is not.
    const ids = campusProjectNavLinks(MENU_UNITS).map((link) => link.id);
    expect(ids).toContain("317");
    expect(ids).toContain("1007");
  });

  it("leaves out a unit with neither a project category nor a hub", () => {
    const ids = campusProjectNavLinks(MENU_UNITS).map((link) => link.id);
    expect(ids).not.toContain("614");
  });

  it("orders by campus, then name", () => {
    expect(campusProjectNavLinks(MENU_UNITS).map((link) => link.id)).toEqual([
      "21",
      "22",
      "24",
      "316",
      "317",
      "1007",
    ]);
  });
});

describe("visibleProjectLinks", () => {
  const links = campusProjectNavLinks(MENU_UNITS);

  it("shows the selected campus's projects plus the national ones", () => {
    expect(visibleProjectLinks(links, "2").map((link) => link.id)).toEqual([
      "316",
      "317",
      "1007",
    ]);
  });

  it("without a campus, hides only hub projects that run on several campuses", () => {
    // Fadderullan runs on two campuses and has a hub in the flagship list.
    // Bergensbaneløpet has a hub but runs in Oslo alone; Charity has no hub
    // at all, so both its campus teams stay listed.
    expect(visibleProjectLinks(links, null).map((link) => link.id)).toEqual([
      "21",
      "22",
      "316",
      "1007",
    ]);
  });

  it("is empty when there are no project units", () => {
    expect(visibleProjectLinks([], "1")).toEqual([]);
    expect(visibleProjectLinks([], null)).toEqual([]);
  });
});

describe("projectLinkLabel", () => {
  const links = campusProjectNavLinks(MENU_UNITS);
  const bergensbanelopet = links.find((link) => link.id === "21");
  const wintergames = links.find((link) => link.id === "1007");

  it("names the campus only when no campus is selected", () => {
    expect(projectLinkLabel(bergensbanelopet!, null)).toBe(
      "Bergensbaneløpet · Oslo"
    );
    expect(projectLinkLabel(bergensbanelopet!, "1")).toBe("Bergensbaneløpet");
  });

  it("never suffixes a national unit", () => {
    expect(projectLinkLabel(wintergames!, null)).toBe("Wintergames");
  });
});

describe("careerDaysHrefs", () => {
  it("links each campus to its own career days unit", () => {
    const hrefs = careerDaysHrefs(UNITS);

    expect(hrefs.oslo).toBe("/units/oslo/karrieredagene");
    expect(hrefs.stavanger).toBe("/units/stavanger/karrieredagene");
  });

  it("falls back to the project page so no card is a dead end", () => {
    const hrefs = careerDaysHrefs(UNITS);

    expect(hrefs.bergen).toBe("/projects/karrieredagene");
    expect(hrefs.trondheim).toBe("/projects/karrieredagene");
  });
});
