import { describe, expect, it } from "vitest";
import {
  getCampusApprovalPlan,
  NATIONAL_APPROVER_EMAIL,
  pickApproverByRole,
  ROLE_EMAIL_PREFIXES,
} from "./expense-approvers";

describe("getCampusApprovalPlan", () => {
  it("plans Oslo as department finance + campus controller", () => {
    const plan = getCampusApprovalPlan({ campusId: "1" });
    expect(plan).toEqual([
      { kind: "department", role: "finance" },
      { kind: "fixed", role: "controller", email: "controller.oslo@biso.no" },
    ]);
  });

  it("asks for the department manager when the submitter is the financial manager", () => {
    const plan = getCampusApprovalPlan({
      campusId: "1",
      submitterIsFinancialManager: true,
    });
    expect(plan[0]).toEqual({ kind: "department", role: "manager" });
  });

  it("plans Ledelsen Oslo (department 2) as controller-only", () => {
    expect(getCampusApprovalPlan({ campusId: "1", departmentId: "2" })).toEqual(
      [{ kind: "fixed", role: "controller", email: "controller.oslo@biso.no" }]
    );
  });

  it("ignores the finance-manager toggle for Ledelsen Oslo", () => {
    expect(
      getCampusApprovalPlan({
        campusId: "1",
        departmentId: "2",
        submitterIsFinancialManager: true,
      })
    ).toEqual([
      { kind: "fixed", role: "controller", email: "controller.oslo@biso.no" },
    ]);
  });

  it("keeps the department step for other Oslo departments", () => {
    expect(getCampusApprovalPlan({ campusId: "1", departmentId: "7" })).toEqual(
      [
        { kind: "department", role: "finance" },
        { kind: "fixed", role: "controller", email: "controller.oslo@biso.no" },
      ]
    );
  });

  it("plans other campuses as controller-only", () => {
    expect(getCampusApprovalPlan({ campusId: "2" })).toEqual([
      { kind: "fixed", role: "controller", email: "controller.bergen@biso.no" },
    ]);
    expect(getCampusApprovalPlan({ campusId: "4" })[0]).toMatchObject({
      email: "controller.stavanger@biso.no",
    });
  });

  it("plans national as the fixed national approver", () => {
    expect(getCampusApprovalPlan({ campusId: "5" })).toEqual([
      { kind: "fixed", role: "national", email: NATIONAL_APPROVER_EMAIL },
    ]);
  });

  it("throws on an unknown campus", () => {
    expect(() => getCampusApprovalPlan({ campusId: "99" })).toThrow(
      "Unknown campus"
    );
  });
});

describe("pickApproverByRole", () => {
  const oslo = [
    { id: "1", email: "finance.nu.oslo@biso.no" },
    { id: "2", email: "manager.nu.oslo@biso.no" },
    { id: "3", email: "ola.nordmann@biso.no" },
  ];

  it("matches the financial manager by the 'financ' prefix", () => {
    expect(
      pickApproverByRole(oslo, ROLE_EMAIL_PREFIXES.finance, "oslo")?.id
    ).toBe("1");
  });

  it("matches 'financial' as well as 'finance'", () => {
    const candidates = [{ id: "x", email: "financial.kd.oslo@biso.no" }];
    expect(
      pickApproverByRole(candidates, ROLE_EMAIL_PREFIXES.finance, "oslo")?.id
    ).toBe("x");
  });

  it("matches the manager and deputy prefixes", () => {
    expect(
      pickApproverByRole(oslo, ROLE_EMAIL_PREFIXES.manager, "oslo")?.id
    ).toBe("2");
    const withDeputy = [{ id: "d", email: "deputy.nu.oslo@biso.no" }];
    expect(
      pickApproverByRole(withDeputy, ROLE_EMAIL_PREFIXES.deputy, "oslo")?.id
    ).toBe("d");
  });

  it("returns null when no candidate matches", () => {
    expect(
      pickApproverByRole(oslo, ROLE_EMAIL_PREFIXES.deputy, "oslo")
    ).toBeNull();
  });

  it("disambiguates multiple campuses by the campus slug", () => {
    const multi = [
      { id: "oslo", email: "finance.nu.oslo@biso.no" },
      { id: "bergen", email: "finance.nu.bergen@biso.no" },
    ];
    expect(
      pickApproverByRole(multi, ROLE_EMAIL_PREFIXES.finance, "bergen")?.id
    ).toBe("bergen");
  });

  it("returns null when the match stays ambiguous", () => {
    const ambiguous = [
      { id: "a", email: "finance.one@biso.no" },
      { id: "b", email: "finance.two@biso.no" },
    ];
    expect(
      pickApproverByRole(ambiguous, ROLE_EMAIL_PREFIXES.finance, "oslo")
    ).toBeNull();
  });
});
