import { describe, expect, it } from "vitest";
import {
  CAMPUS_SCOPED_PATHS,
  CAMPUS_SLUGS,
  campusIdToSlug,
  campusLandingHref,
  campusScopeIds,
  campusSlugToId,
  campusSwitchHref,
  isCampusScopedPath,
  NATIONAL_CAMPUS_ID,
  parseCampusParam,
  resolveRequestCampus,
} from "./campus-scope";

describe("campusScopeIds", () => {
  it("does not filter when no campus is selected", () => {
    expect(campusScopeIds(null)).toBeNull();
    expect(campusScopeIds(undefined)).toBeNull();
    expect(campusScopeIds("")).toBeNull();
  });

  it("does not filter for the explicit all-campuses selection", () => {
    expect(campusScopeIds("all")).toBeNull();
  });

  it("pairs a study campus with National", () => {
    expect(campusScopeIds("1")).toEqual(["1", NATIONAL_CAMPUS_ID]);
    expect(campusScopeIds("2")).toEqual(["2", NATIONAL_CAMPUS_ID]);
  });

  it("does not duplicate National when National is selected", () => {
    expect(campusScopeIds(NATIONAL_CAMPUS_ID)).toEqual([NATIONAL_CAMPUS_ID]);
  });

  it("excludes campuses other than the selected one and National", () => {
    const scope = campusScopeIds("2");
    expect(scope).not.toContain("1");
    expect(scope).toHaveLength(2);
  });
});

describe("parseCampusParam", () => {
  it("treats an absent or empty parameter as absent, not as all", () => {
    // These must fall through to the cookie. Collapsing "absent" into "all"
    // would silently override a visitor's remembered campus on every page.
    expect(parseCampusParam(undefined)).toEqual({ kind: "absent" });
    expect(parseCampusParam("")).toEqual({ kind: "absent" });
  });

  it("treats an explicit `all` as an override, not as absent", () => {
    // The unfiltered view has to be linkable from a machine that has a campus
    // cookie set, so `?campus=all` must beat the cookie.
    expect(parseCampusParam("all")).toEqual({ kind: "all" });
  });

  it("accepts slugs", () => {
    expect(parseCampusParam("oslo")).toEqual({ kind: "campus", id: "1" });
    expect(parseCampusParam("BERGEN")).toEqual({ kind: "campus", id: "2" });
    expect(parseCampusParam("national")).toEqual({ kind: "campus", id: "5" });
  });

  it("still accepts raw ids, which /jobs has supported", () => {
    expect(parseCampusParam("1")).toEqual({ kind: "campus", id: "1" });
    expect(parseCampusParam("5")).toEqual({ kind: "campus", id: "5" });
  });

  it("rejects anything else rather than falling back to everything", () => {
    // A typo must 404, not quietly return national content the URL does not
    // describe.
    for (const bad of ["osloo", "6", "0", "../oslo", "oslo,bergen"]) {
      expect(parseCampusParam(bad)).toEqual({ kind: "invalid" });
    }
  });

  it("treats a repeated parameter as a single value", () => {
    expect(parseCampusParam(["oslo", "bergen"])).toEqual({
      kind: "campus",
      id: "1",
    });
  });
});

describe("resolveRequestCampus — URL beats cookie beats all", () => {
  it("uses the URL when present", () => {
    expect(resolveRequestCampus("bergen", "1")).toBe("2");
  });

  it("falls back to the cookie when the URL says nothing", () => {
    expect(resolveRequestCampus(undefined, "3")).toBe("3");
  });

  it("lets an explicit `all` override the cookie", () => {
    expect(resolveRequestCampus("all", "1")).toBeNull();
  });

  it("returns no filter when neither is set", () => {
    expect(resolveRequestCampus(undefined, null)).toBeNull();
    expect(resolveRequestCampus(undefined, "all")).toBeNull();
  });

  it("signals an invalid parameter so the caller can 404", () => {
    expect(resolveRequestCampus("nope", "1")).toBeUndefined();
  });
});

describe("slug mapping", () => {
  it("round-trips every campus", () => {
    for (const slug of CAMPUS_SLUGS) {
      const id = campusSlugToId(slug);
      expect(id).not.toBeNull();
      expect(campusIdToSlug(id)).toBe(slug);
    }
  });

  it("covers all five campuses, National included", () => {
    expect(CAMPUS_SLUGS).toEqual([
      "oslo",
      "bergen",
      "trondheim",
      "stavanger",
      "national",
    ]);
  });
});

describe("campusSwitchHref — the switcher filters in place", () => {
  it("stays on a scoped feed and rewrites the parameter", () => {
    // The whole complaint this replaces: picking Bergen from /events used to
    // navigate to /campus/bergen, so asking for Bergen's events left the
    // events page.
    expect(campusSwitchHref("/events", "", "2")).toBe("/events?campus=bergen");
    expect(campusSwitchHref("/", "", "1")).toBe("/?campus=oslo");
  });

  it("keeps every other filter when campus changes", () => {
    // Switching campus out of a searched, filtered view must not silently
    // throw the search and the category away.
    expect(
      campusSwitchHref("/events", "search=karriere&category=party", "3")
    ).toBe("/events?search=karriere&category=party&campus=trondheim");
  });

  it("replaces an existing campus rather than appending a second one", () => {
    const href = campusSwitchHref("/jobs", "campus=oslo&paid=true", "2");
    expect(href).toBe("/jobs?campus=bergen&paid=true");
    expect(href?.match(/campus=/g)).toHaveLength(1);
  });

  it("writes an explicit campus=all instead of dropping the parameter", () => {
    // The URL has to be authoritative on its own: dropping it would fall back
    // to the reader's cookie, so "all campuses" would not survive being
    // shared, and would race the cookie write that accompanies the click.
    expect(campusSwitchHref("/news", "campus=oslo", null)).toBe(
      "/news?campus=all"
    );
  });

  it("navigates between landings on the campus pages, where campus is the route", () => {
    expect(campusSwitchHref("/campus/oslo", "", "2")).toBe("/campus/bergen");
    expect(campusSwitchHref("/campus/oslo", "", null)).toBe("/campus");
    expect(campusSwitchHref("/campus", "", "4")).toBe("/campus/stavanger");
  });

  it("returns null where there is nothing to re-scope", () => {
    // No parameter is hung on a page that ignores it; the caller persists the
    // cookie instead.
    for (const path of [
      "/about",
      "/contact",
      "/shop/cart",
      "/units/oslo/kbs",
    ]) {
      expect(campusSwitchHref(path, "", "1"), path).toBeNull();
    }
  });

  it("scopes the feed indexes but not their detail pages", () => {
    expect(isCampusScopedPath("/shop")).toBe(true);
    expect(isCampusScopedPath("/shop/cart")).toBe(false);
    expect(isCampusScopedPath("/units")).toBe(true);
    expect(isCampusScopedPath("/units/oslo/kbs")).toBe(false);
  });

  it("every advertised path is a real campus slug round-trip", () => {
    for (const slug of CAMPUS_SLUGS) {
      const id = campusSlugToId(slug);
      expect(campusSwitchHref("/events", "", id)).toBe(
        `/events?campus=${slug}`
      );
    }
  });
});

describe("campusLandingHref", () => {
  it("points at the active campus, and the index when there is none", () => {
    expect(campusLandingHref("1")).toBe("/campus/oslo");
    expect(campusLandingHref("5")).toBe("/campus/national");
    expect(campusLandingHref(null)).toBe("/campus");
  });

  it("falls back to the index for an id with no landing page", () => {
    expect(campusLandingHref("999")).toBe("/campus");
  });
});

describe("CAMPUS_SCOPED_PATHS", () => {
  it("is sorted and free of duplicates, so the list stays reviewable", () => {
    const paths = [...CAMPUS_SCOPED_PATHS];
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toEqual([...paths].sort());
  });
});
