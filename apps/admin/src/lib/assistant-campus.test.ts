import { describe, expect, test } from "bun:test";
import { resolveConfirmedCampusId } from "./assistant-campus";

describe("resolveConfirmedCampusId", () => {
  test("prefers the confirmed campus over anything in the payload", () => {
    expect(
      resolveConfirmedCampusId("1", { campus_id: "2", campusId: "3" })
    ).toBe("1");
  });

  test("falls back to campus_id, then the campusId alias", () => {
    expect(resolveConfirmedCampusId(undefined, { campus_id: "2" })).toBe("2");
    expect(resolveConfirmedCampusId(undefined, { campusId: "3" })).toBe("3");
    expect(
      resolveConfirmedCampusId(undefined, { campus_id: "2", campusId: "3" })
    ).toBe("2");
  });

  test("skips blank values at every step and trims the one it keeps", () => {
    expect(resolveConfirmedCampusId("", { campus_id: "", campusId: "3" })).toBe(
      "3"
    );
    expect(
      resolveConfirmedCampusId("  ", { campus_id: " 2 ", campusId: "3" })
    ).toBe("2");
  });

  test("accepts a numeric campus id", () => {
    expect(resolveConfirmedCampusId(undefined, { campus_id: 4 })).toBe("4");
  });

  test("returns null when no campus is given", () => {
    expect(resolveConfirmedCampusId(undefined, {})).toBeNull();
    expect(
      resolveConfirmedCampusId(undefined, { campus_id: "", campusId: " " })
    ).toBeNull();
  });
});
