import { describe, expect, test } from "bun:test";
import { Query } from "@repo/api";
import type { UserAuthContext } from "@/lib/authorization";
import { NATIONAL_CAMPUS_ID } from "@/lib/event-scope";
import { NO_MATCH_FILTER } from "@/lib/utils/authorization";
import {
  bigEventAccess,
  canCreateBigEvent,
  canEditBigEventSettings,
  canSeeParticipant,
  participantCampusFilter,
  visibleBigEventFilters,
} from "./access";

const OSLO = "1";
const BERGEN = "2";

const baseCtx: UserAuthContext = {
  campusNames: [],
  campusTeamIds: [],
  departmentNames: [],
  departmentTeamIds: [],
  email: null,
  managedCampusIds: [],
  managedCampuses: [],
  name: null,
  resolvedCampusIds: [],
  resolvedDepartmentIds: [],
  roles: [],
  userId: "u1",
};

const globalAdmin: UserAuthContext = { ...baseCtx, roles: ["globaladmin"] };
const bergenAdmin: UserAuthContext = {
  ...baseCtx,
  managedCampusIds: [BERGEN],
  roles: ["campusadmin"],
};
const deptMember: UserAuthContext = {
  ...baseCtx,
  resolvedDepartmentIds: ["dept-1"],
};

const winterGames = { campus_id: NATIONAL_CAMPUS_ID, department_id: "dept-1" };
const nationalNoDept = { campus_id: NATIONAL_CAMPUS_ID, department_id: null };
const osloEvent = { campus_id: OSLO, department_id: null };
const bergenEvent = { campus_id: BERGEN, department_id: null };

describe("bigEventAccess", () => {
  test("global admin has full access to every big event", () => {
    expect(bigEventAccess(globalAdmin, osloEvent)).toEqual({ level: "full" });
    expect(bigEventAccess(globalAdmin, winterGames)).toEqual({ level: "full" });
  });

  test("owning department member has full access", () => {
    expect(bigEventAccess(deptMember, winterGames)).toEqual({ level: "full" });
  });

  test("department member of another department has no access", () => {
    expect(
      bigEventAccess(
        { ...deptMember, resolvedDepartmentIds: ["dept-2"] },
        winterGames
      )
    ).toBeNull();
  });

  test("campus admin gets campus-level access to a big event on a campus they manage", () => {
    expect(bigEventAccess(bergenAdmin, bergenEvent)).toEqual({
      campusIds: [BERGEN],
      canEditSettings: true,
      level: "campus",
    });
  });

  test("campus admin has no access to another campus's big event", () => {
    expect(bigEventAccess(bergenAdmin, osloEvent)).toBeNull();
  });

  test("campus admin gets campus-level access to a National big event", () => {
    expect(bigEventAccess(bergenAdmin, nationalNoDept)).toEqual({
      campusIds: [BERGEN],
      canEditSettings: false,
      level: "campus",
    });
  });

  test("full wins when several rules apply", () => {
    const both = { ...bergenAdmin, resolvedDepartmentIds: ["dept-1"] };
    expect(bigEventAccess(both, winterGames)).toEqual({ level: "full" });
  });

  test("a user with no role or department gets null", () => {
    expect(bigEventAccess(baseCtx, osloEvent)).toBeNull();
    expect(bigEventAccess(baseCtx, nationalNoDept)).toBeNull();
  });

  test("a department member with a null department_id event gets null", () => {
    expect(bigEventAccess(deptMember, nationalNoDept)).toBeNull();
  });
});

describe("canCreateBigEvent", () => {
  test("global admin may create on any campus", () => {
    expect(canCreateBigEvent(globalAdmin, OSLO)).toBe(true);
    expect(canCreateBigEvent(globalAdmin, NATIONAL_CAMPUS_ID)).toBe(true);
  });

  test("campus admin may create only on a managed non-National campus", () => {
    expect(canCreateBigEvent(bergenAdmin, BERGEN)).toBe(true);
    expect(canCreateBigEvent(bergenAdmin, OSLO)).toBe(false);
    const withNational = {
      ...bergenAdmin,
      managedCampusIds: [BERGEN, NATIONAL_CAMPUS_ID],
    };
    expect(canCreateBigEvent(withNational, NATIONAL_CAMPUS_ID)).toBe(false);
  });

  test("department members and others may not create", () => {
    expect(canCreateBigEvent(deptMember, OSLO)).toBe(false);
    expect(canCreateBigEvent(baseCtx, OSLO)).toBe(false);
  });
});

describe("canEditBigEventSettings", () => {
  test("only full access may edit settings", () => {
    expect(canEditBigEventSettings({ level: "full" })).toBe(true);
    expect(
      canEditBigEventSettings({
        campusIds: [BERGEN],
        canEditSettings: false,
        level: "campus",
      })
    ).toBe(false);
    expect(
      canEditBigEventSettings({
        campusIds: [BERGEN],
        canEditSettings: true,
        level: "campus",
      })
    ).toBe(true);
    expect(canEditBigEventSettings(null)).toBe(false);
  });
});

describe("visibleBigEventFilters", () => {
  test("global admin sees everything", () => {
    expect(visibleBigEventFilters(globalAdmin)).toEqual([]);
  });

  test("global admin with an active campus filters to it", () => {
    expect(
      visibleBigEventFilters({ ...globalAdmin, activeCampusId: OSLO })
    ).toEqual([Query.equal("campus_id", [OSLO])]);
  });

  test("campus admin sees managed campuses plus National", () => {
    expect(visibleBigEventFilters(bergenAdmin)).toEqual([
      Query.equal("campus_id", [BERGEN, NATIONAL_CAMPUS_ID]),
    ]);
  });

  test("department member sees their departments' big events", () => {
    expect(visibleBigEventFilters(deptMember)).toEqual([
      Query.equal("department_id", ["dept-1"]),
    ]);
  });

  test("campus admin who is also a department member ORs both reaches", () => {
    const both = { ...bergenAdmin, resolvedDepartmentIds: ["dept-1"] };
    expect(visibleBigEventFilters(both)).toEqual([
      Query.or([
        Query.equal("campus_id", [BERGEN, NATIONAL_CAMPUS_ID]),
        Query.equal("department_id", ["dept-1"]),
      ]),
    ]);
  });

  test("a user with neither reach matches nothing", () => {
    expect(visibleBigEventFilters(baseCtx)).toEqual([NO_MATCH_FILTER]);
  });
});

describe("participant visibility", () => {
  test("full access has no participant campus filter", () => {
    expect(participantCampusFilter({ level: "full" })).toEqual([]);
  });

  test("campus access filters participants to the campuses", () => {
    expect(
      participantCampusFilter({
        campusIds: [BERGEN],
        canEditSettings: false,
        level: "campus",
      })
    ).toEqual([Query.equal("campus_id", [BERGEN])]);
  });

  test("no access fails closed", () => {
    expect(participantCampusFilter(null)).toEqual([NO_MATCH_FILTER]);
  });

  test("a Bergen campus admin sees only Bergen participants in Winter Games", () => {
    const access = bigEventAccess(bergenAdmin, nationalNoDept);
    expect(canSeeParticipant(access, { campus_id: BERGEN })).toBe(true);
    expect(canSeeParticipant(access, { campus_id: OSLO })).toBe(false);
  });

  test("nobody but full access sees a participant without a campus", () => {
    expect(canSeeParticipant({ level: "full" }, { campus_id: null })).toBe(
      true
    );
    expect(
      canSeeParticipant(
        { campusIds: [BERGEN], canEditSettings: true, level: "campus" },
        { campus_id: null }
      )
    ).toBe(false);
    expect(canSeeParticipant(null, { campus_id: null })).toBe(false);
    expect(canSeeParticipant(null, { campus_id: BERGEN })).toBe(false);
  });
});

describe("campus admin scoping (R16)", () => {
  test("a Bergen admin on a Bergen big event edits settings but sees only Bergen participants", () => {
    const access = bigEventAccess(bergenAdmin, bergenEvent);
    expect(canEditBigEventSettings(access)).toBe(true);
    expect(canSeeParticipant(access, { campus_id: BERGEN })).toBe(true);
    expect(participantCampusFilter(access)).toEqual([
      Query.equal("campus_id", [BERGEN]),
    ]);
  });

  test("a Bergen admin on a Bergen big event doesn't see an Oslo or a no-campus participant", () => {
    const access = bigEventAccess(bergenAdmin, bergenEvent);
    expect(canSeeParticipant(access, { campus_id: OSLO })).toBe(false);
    expect(canSeeParticipant(access, { campus_id: null })).toBe(false);
  });

  test("a Bergen admin on Winter Games (another board's National event) can't edit settings", () => {
    expect(
      canEditBigEventSettings(bigEventAccess(bergenAdmin, nationalNoDept))
    ).toBe(false);
  });

  test("a campus admin with no managed campuses gets no access", () => {
    const none = { ...bergenAdmin, managedCampusIds: [] };
    expect(bigEventAccess(none, bergenEvent)).toBeNull();
    expect(bigEventAccess(none, nationalNoDept)).toBeNull();
  });

  test("National never appears in campusIds even with withNationalEventScope", () => {
    const widened = withNationalEventScope(bergenAdmin);
    for (const event of [bergenEvent, nationalNoDept]) {
      const access = bigEventAccess(widened, event);
      expect(access?.level).toBe("campus");
      if (access?.level === "campus") {
        expect(access.campusIds).toEqual([BERGEN]);
      }
    }
  });

  test("participantCampusFilter never builds an empty equal", () => {
    expect(
      participantCampusFilter({
        campusIds: [],
        canEditSettings: true,
        level: "campus",
      })
    ).toEqual([NO_MATCH_FILTER]);
  });
});
