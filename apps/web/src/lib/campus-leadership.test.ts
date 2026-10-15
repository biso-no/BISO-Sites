import { describe, expect, it } from "vitest";
import {
  leadershipCampusId,
  localizedFocusAreas,
  managementDepartmentId,
} from "./campus-leadership";

describe("leadershipCampusId", () => {
  it("shows the selected campus, else National", () => {
    expect(leadershipCampusId("2")).toBe("2");
    expect(leadershipCampusId(null)).toBe("5");
  });
});

describe("managementDepartmentId", () => {
  it("maps every campus to its management unit", () => {
    expect(managementDepartmentId("1")).toBe("2");
    expect(managementDepartmentId("5")).toBe("1002");
    expect(managementDepartmentId("9")).toBeNull();
  });
});

describe("localizedFocusAreas", () => {
  const metadata = { focusAreas_en: ["Career"], focusAreas_nb: ["Karriere"] };

  it("prefers the visitor's language", () => {
    expect(localizedFocusAreas(metadata, "no")).toEqual(["Karriere"]);
    expect(localizedFocusAreas(metadata, "en")).toEqual(["Career"]);
  });

  it("falls back to the other language, then to nothing", () => {
    expect(
      localizedFocusAreas(
        { focusAreas_en: [], focusAreas_nb: ["Karriere"] },
        "en"
      )
    ).toEqual(["Karriere"]);
    expect(localizedFocusAreas(null, "no")).toEqual([]);
  });
});
