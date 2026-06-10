import { describe, expect, test } from "bun:test";
import type {
  DepartmentResolution,
  M365UserListItem,
} from "@repo/shared/types/user-management";
import {
  buildRemediationPlan,
  validateResolution,
} from "./remediation-bucketing";

const CAMPUS_NAMES = new Set(["Oslo", "Bergen"]);
const CANDIDATES = new Map<string, Set<string>>([
  ["Oslo", new Set(["Ledelsen Oslo", "OSL Næringslivsutvalget"])],
  ["Bergen", new Set(["Ledelsen Bergen"])],
]);
const NO_CLOSED = new Set<string>();

function user(
  id: string,
  over: Partial<M365UserListItem> = {}
): M365UserListItem {
  return {
    accountEnabled: true,
    createdDateTime: null,
    department: null,
    displayName: id,
    id,
    jobTitle: null,
    lastSignInDateTime: null,
    mail: `${id}@biso.no`,
    officeLocation: null,
    userPrincipalName: `${id}@biso.no`,
    ...over,
  };
}

function res(over: Partial<DepartmentResolution>): DepartmentResolution {
  return {
    ref: "u",
    classification: "department",
    department: null,
    campus: null,
    confidence: "high",
    reasoning: "",
    ...over,
  };
}

describe("validateResolution", () => {
  test("management with a known campus resolves to Ledelsen {campus}", () => {
    expect(
      validateResolution(
        res({ classification: "management", campus: "Oslo" }),
        CANDIDATES,
        CAMPUS_NAMES
      )
    ).toEqual({ department: "Ledelsen Oslo", campus: "Oslo" });
  });

  test("department off-list returns null (forced to manual)", () => {
    expect(
      validateResolution(
        res({
          classification: "department",
          department: "Made Up Dept",
          campus: "Oslo",
        }),
        CANDIDATES,
        CAMPUS_NAMES
      )
    ).toBeNull();
  });

  test("department on-list resolves", () => {
    expect(
      validateResolution(
        res({
          classification: "department",
          department: "OSL Næringslivsutvalget",
          campus: "Oslo",
        }),
        CANDIDATES,
        CAMPUS_NAMES
      )
    ).toEqual({ department: "OSL Næringslivsutvalget", campus: "Oslo" });
  });

  test("unknown campus returns null", () => {
    expect(
      validateResolution(
        res({ classification: "management", campus: "Narnia" }),
        CANDIDATES,
        CAMPUS_NAMES
      )
    ).toBeNull();
  });
});

describe("buildRemediationPlan", () => {
  test("high-confidence management → safe, grouped by Ledelsen Oslo", () => {
    const users = [user("president.oslo"), user("controller.oslo")];
    const resolutions = new Map([
      [
        "president.oslo",
        res({
          ref: "president.oslo",
          classification: "management",
          campus: "Oslo",
        }),
      ],
      [
        "controller.oslo",
        res({
          ref: "controller.oslo",
          classification: "management",
          campus: "Oslo",
        }),
      ],
    ]);
    const plan = buildRemediationPlan({
      users,
      resolutions,
      candidatesByCampus: CANDIDATES,
      closedBaseNames: NO_CLOSED,
      campusNames: CAMPUS_NAMES,
    });
    expect(plan.safe).toHaveLength(1);
    expect(plan.safe[0].suggestedDepartment).toBe("Ledelsen Oslo");
    expect(plan.safe[0].affectedUsers).toHaveLength(2);
    expect(plan.manual).toHaveLength(0);
  });

  test("a non-management user the model marks manual never lands in Ledelsen (the 29-bug)", () => {
    const users = [user("hr.oslo", { department: "Ledelse" })];
    const resolutions = new Map([
      [
        "hr.oslo",
        res({
          ref: "hr.oslo",
          classification: "manual",
          campus: null,
          department: null,
          reasoning: "HR function",
        }),
      ],
    ]);
    const plan = buildRemediationPlan({
      users,
      resolutions,
      candidatesByCampus: CANDIDATES,
      closedBaseNames: NO_CLOSED,
      campusNames: CAMPUS_NAMES,
    });
    expect(plan.safe).toHaveLength(0);
    expect(plan.manual).toHaveLength(1);
    expect(plan.manual[0].user.id).toBe("hr.oslo");
  });

  test("medium confidence → review, not safe", () => {
    const users = [user("a")];
    const resolutions = new Map([
      [
        "a",
        res({
          ref: "a",
          classification: "department",
          department: "OSL Næringslivsutvalget",
          campus: "Oslo",
          confidence: "medium",
        }),
      ],
    ]);
    const plan = buildRemediationPlan({
      users,
      resolutions,
      candidatesByCampus: CANDIDATES,
      closedBaseNames: NO_CLOSED,
      campusNames: CAMPUS_NAMES,
    });
    expect(plan.safe).toHaveLength(0);
    expect(plan.review).toHaveLength(1);
    expect(plan.review[0].suggestedDepartment).toBe("OSL Næringslivsutvalget");
  });

  test("low confidence → review, not safe", () => {
    const users = [user("a")];
    const resolutions = new Map([
      [
        "a",
        res({
          ref: "a",
          classification: "department",
          department: "OSL Næringslivsutvalget",
          campus: "Oslo",
          confidence: "low",
        }),
      ],
    ]);
    const plan = buildRemediationPlan({
      users,
      resolutions,
      candidatesByCampus: CANDIDATES,
      closedBaseNames: NO_CLOSED,
      campusNames: CAMPUS_NAMES,
    });
    expect(plan.safe).toHaveLength(0);
    expect(plan.review).toHaveLength(1);
  });

  test("off-list department → manual", () => {
    const users = [user("a")];
    const resolutions = new Map([
      [
        "a",
        res({
          ref: "a",
          classification: "department",
          department: "Ghost Unit",
          campus: "Oslo",
        }),
      ],
    ]);
    const plan = buildRemediationPlan({
      users,
      resolutions,
      candidatesByCampus: CANDIDATES,
      closedBaseNames: NO_CLOSED,
      campusNames: CAMPUS_NAMES,
    });
    expect(plan.manual).toHaveLength(1);
  });

  test("missing resolution → manual", () => {
    const plan = buildRemediationPlan({
      users: [user("a")],
      resolutions: new Map(),
      candidatesByCampus: CANDIDATES,
      closedBaseNames: NO_CLOSED,
      campusNames: CAMPUS_NAMES,
    });
    expect(plan.manual).toHaveLength(1);
  });

  test("already-compliant user is counted and dropped from safe", () => {
    const users = [
      user("president.oslo", {
        department: "Ledelsen Oslo",
        officeLocation: "Oslo",
      }),
    ];
    const resolutions = new Map([
      [
        "president.oslo",
        res({
          ref: "president.oslo",
          classification: "management",
          campus: "Oslo",
        }),
      ],
    ]);
    const plan = buildRemediationPlan({
      users,
      resolutions,
      candidatesByCampus: CANDIDATES,
      closedBaseNames: NO_CLOSED,
      campusNames: CAMPUS_NAMES,
    });
    expect(plan.safe).toHaveLength(0);
    expect(plan.compliantCount).toBe(1);
  });

  test("current department matching a closed base name → closed bucket", () => {
    const users = [user("a", { department: "DataAnalytisk Utvalg" })];
    const plan = buildRemediationPlan({
      users,
      resolutions: new Map([
        ["a", res({ ref: "a", classification: "manual" })],
      ]),
      candidatesByCampus: CANDIDATES,
      closedBaseNames: new Set(["dataanalytisk utvalg"]),
      campusNames: CAMPUS_NAMES,
    });
    expect(plan.closed).toHaveLength(1);
    expect(plan.manual).toHaveLength(0);
  });

  test("empty users array → empty plan", () => {
    const plan = buildRemediationPlan({
      users: [],
      resolutions: new Map(),
      candidatesByCampus: CANDIDATES,
      closedBaseNames: NO_CLOSED,
      campusNames: CAMPUS_NAMES,
    });
    expect(plan.totalScanned).toBe(0);
    expect(plan.safe).toHaveLength(0);
    expect(plan.review).toHaveLength(0);
    expect(plan.manual).toHaveLength(0);
    expect(plan.closed).toHaveLength(0);
    expect(plan.compliantCount).toBe(0);
  });
});
