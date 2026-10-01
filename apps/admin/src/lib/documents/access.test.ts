import { describe, expect, test } from "bun:test";
import type { UserAuthContext } from "@/lib/authorization";
import {
  canManageAllDocuments,
  documentAccessContext,
  isControlCommittee,
} from "./access";

function makeCtx(overrides: Partial<UserAuthContext> = {}): UserAuthContext {
  return {
    activeCampusId: undefined,
    campusNames: [],
    campusTeamIds: [],
    departmentNames: [],
    departmentTeamIds: [],
    email: null,
    managedCampuses: [],
    managedCampusIds: [],
    name: null,
    resolvedCampusIds: [],
    resolvedDepartmentIds: [],
    roles: [],
    userId: "user-1",
    ...overrides,
  };
}

const committeeMember = makeCtx({
  // A stale campus filter must not narrow the committee's reach.
  activeCampusId: "1",
  campusNames: ["Bergen"],
  departmentNames: ["Control Committee"],
  departmentTeamIds: ["sg-app-dept-controlcommittee"],
  resolvedCampusIds: ["2"],
});
const otherDepartment = makeCtx({
  campusNames: ["Bergen"],
  departmentNames: ["Finance Committee"],
  departmentTeamIds: ["sg-app-dept-financecommittee"],
  resolvedCampusIds: ["2"],
});

describe("isControlCommittee", () => {
  test("matches the team synced from the Azure group", () => {
    expect(isControlCommittee(committeeMember)).toBe(true);
  });

  test("does not match other departments", () => {
    expect(isControlCommittee(makeCtx())).toBe(false);
    expect(isControlCommittee(otherDepartment)).toBe(false);
  });

  test("ignores a team that only carries the committee's name", () => {
    const lookalike = makeCtx({
      departmentNames: ["Control Committee"],
      departmentTeamIds: ["sg-app-dept-financecommittee"],
    });
    expect(isControlCommittee(lookalike)).toBe(false);
    const nearMiss = makeCtx({
      departmentNames: ["Control Committee Bergen"],
      departmentTeamIds: ["sg-app-dept-controlcommitteebergen"],
    });
    expect(isControlCommittee(nearMiss)).toBe(false);
  });
});

describe("canManageAllDocuments", () => {
  test("is true for control committee members and global admins", () => {
    expect(canManageAllDocuments(committeeMember)).toBe(true);
    expect(canManageAllDocuments(makeCtx({ roles: ["globaladmin"] }))).toBe(
      true
    );
  });

  test("is false for campus admins and other departments", () => {
    expect(canManageAllDocuments(otherDepartment)).toBe(false);
    expect(
      canManageAllDocuments(
        makeCtx({ managedCampusIds: ["2"], roles: ["campusadmin"] })
      )
    ).toBe(false);
  });
});

describe("documentAccessContext", () => {
  test("gives a control committee member organisation-wide document access", () => {
    const access = documentAccessContext(committeeMember);

    expect(access.roles).toContain("globaladmin");
    expect(access.activeCampusId).toBeUndefined();
    expect(access.userId).toBe(committeeMember.userId);
  });

  test("does not change the caller's own context", () => {
    documentAccessContext(committeeMember);

    expect(committeeMember.roles).toEqual([]);
  });

  test("returns everyone else's context unchanged", () => {
    expect(documentAccessContext(otherDepartment)).toBe(otherDepartment);
    const globalAdmin = makeCtx({
      activeCampusId: "1",
      roles: ["globaladmin"],
    });
    expect(documentAccessContext(globalAdmin)).toBe(globalAdmin);
  });
});
