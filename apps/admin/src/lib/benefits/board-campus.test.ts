import { describe, expect, it } from "bun:test";
import { orderBoardCampuses, resolveBoardCampus } from "./board-campus";

const everyone = {
  editableCampusIds: ["1", "2", "3", "4", "5"],
  visibleCampusIds: ["1", "2", "3", "4", "5"],
};
const bergenAdmin = {
  editableCampusIds: ["2"],
  visibleCampusIds: ["2", "5"],
};

describe("orderBoardCampuses", () => {
  it("keeps the fixed tab order whatever order access lists them in", () => {
    expect(orderBoardCampuses(["5", "4", "2"])).toEqual(["2", "4", "5"]);
  });

  it("drops ids that are not campuses", () => {
    expect(orderBoardCampuses(["2", "99", ""])).toEqual(["2"]);
  });
});

describe("resolveBoardCampus", () => {
  it("prefers the search param", () => {
    expect(
      resolveBoardCampus({ ...everyone, remembered: "3", requested: "4" })
    ).toBe("4");
  });

  it("falls back to the remembered tab", () => {
    expect(resolveBoardCampus({ ...everyone, remembered: "3" })).toBe("3");
  });

  it("then opens the first campus the viewer can edit", () => {
    expect(resolveBoardCampus(bergenAdmin)).toBe("2");
  });

  it("opens Hele BISO for a viewer who can edit nothing", () => {
    expect(
      resolveBoardCampus({ editableCampusIds: [], visibleCampusIds: ["5"] })
    ).toBe("5");
  });

  it("skips a campus the viewer cannot see", () => {
    expect(
      resolveBoardCampus({ ...bergenAdmin, remembered: "1", requested: "3" })
    ).toBe("2");
  });

  it("returns null when nothing is visible", () => {
    expect(
      resolveBoardCampus({
        editableCampusIds: [],
        requested: "2",
        visibleCampusIds: [],
      })
    ).toBeNull();
  });
});
