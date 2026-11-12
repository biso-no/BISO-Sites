import { describe, expect, it } from "vitest";
import {
  approvalSwitchFor,
  CAMPUS_MAILBOX_SLUGS,
  DEFAULT_DIRECTORY_EMAILS,
  directoryKey,
  getCampusApprovalPlan,
  NATIONAL_APPROVER_EMAIL,
  pickApproverByRole,
  ROLE_EMAIL_PREFIXES,
} from "./expense-approvers";

const controller = { kind: "directory", role: "controller" } as const;
const president = { kind: "directory", role: "president" } as const;

describe("getCampusApprovalPlan", () => {
  it("Oslo OSL switch off: department finance then controller", () => {
    expect(getCampusApprovalPlan({ campusId: "1", departmentId: "7" })).toEqual(
      [{ kind: "department", role: "finance" }, controller]
    );
  });

  it("Oslo OSL switch on: department manager then controller", () => {
    expect(
      getCampusApprovalPlan({
        campusId: "1",
        departmentId: "7",
        submitterIsFinancialManager: true,
      })
    ).toEqual([{ kind: "department", role: "manager" }, controller]);
  });

  it.each(["1", "2"])("Oslo department %s switch off: controller", (id) => {
    expect(getCampusApprovalPlan({ campusId: "1", departmentId: id })).toEqual([
      controller,
    ]);
  });

  it.each(["1", "2"])("Oslo department %s switch on: president", (id) => {
    expect(
      getCampusApprovalPlan({
        campusId: "1",
        departmentId: id,
        submitterIsController: true,
      })
    ).toEqual([president]);
  });

  it("Bergen Ledelsen (301) off and on", () => {
    expect(
      getCampusApprovalPlan({ campusId: "2", departmentId: "301" })
    ).toEqual([controller]);
    expect(
      getCampusApprovalPlan({
        campusId: "2",
        departmentId: "301",
        submitterIsController: true,
      })
    ).toEqual([president]);
  });

  it("Trondheim Drift (600) on: president", () => {
    expect(
      getCampusApprovalPlan({
        campusId: "3",
        departmentId: "600",
        submitterIsController: true,
      })
    ).toEqual([president]);
  });

  it("Stavanger other department: controller only", () => {
    expect(
      getCampusApprovalPlan({ campusId: "4", departmentId: "810" })
    ).toEqual([controller]);
    expect(getCampusApprovalPlan({ campusId: "4" })).toEqual([controller]);
  });

  it("national: national only", () => {
    expect(getCampusApprovalPlan({ campusId: "5" })).toEqual([
      { kind: "directory", role: "national" },
    ]);
  });

  it("ignores a switch that does not apply", () => {
    expect(
      getCampusApprovalPlan({
        campusId: "1",
        departmentId: "2",
        submitterIsFinancialManager: true,
      })
    ).toEqual([controller]);
    expect(
      getCampusApprovalPlan({
        campusId: "1",
        departmentId: "101",
        submitterIsController: true,
      })
    ).toEqual([{ kind: "department", role: "finance" }, controller]);
    expect(
      getCampusApprovalPlan({
        campusId: "2",
        departmentId: "302",
        submitterIsController: true,
      })
    ).toEqual([controller]);
  });

  it("routes a controller's own expense to the president only", () => {
    const plan = getCampusApprovalPlan({
      campusId: "1",
      departmentId: "1",
      submitterIsController: true,
    });
    expect(plan).toHaveLength(1);
    expect(plan.some((step) => step.role === "controller")).toBe(false);
  });

  it("throws on an unknown campus", () => {
    expect(() => getCampusApprovalPlan({ campusId: "99" })).toThrow(
      "Unknown campus"
    );
  });
});

describe("approvalSwitchFor", () => {
  it("offers the financial manager switch to Oslo departments", () => {
    expect(approvalSwitchFor("1", "7")).toBe("financial_manager");
    expect(approvalSwitchFor("1", null)).toBe("financial_manager");
  });

  it("offers the controller switch to Drift and Ledelsen", () => {
    for (const [campus, dept] of [
      ["1", "1"],
      ["1", "2"],
      ["2", "300"],
      ["2", "301"],
      ["3", "600"],
      ["3", "601"],
      ["4", "800"],
      ["4", "801"],
    ] as const) {
      expect(approvalSwitchFor(campus, dept)).toBe("controller");
    }
  });

  it("offers nothing elsewhere", () => {
    expect(approvalSwitchFor("2", "302")).toBeNull();
    expect(approvalSwitchFor("5", "9")).toBeNull();
    expect(approvalSwitchFor("3", undefined)).toBeNull();
  });
});

describe("cross-campus leadership departments", () => {
  it("keeps Bergen's leadership ids off Oslo and Trondheim's off Bergen", () => {
    expect(approvalSwitchFor("1", "300")).toBe("financial_manager");
    expect(approvalSwitchFor("2", "600")).toBeNull();
  });

  it("gives a controller submitter in another campus's department only a controller step", () => {
    expect(
      getCampusApprovalPlan({
        campusId: "2",
        departmentId: "600",
        submitterIsController: true,
      })
    ).toEqual([controller]);
  });
});

describe("directoryKey", () => {
  it("formats department and campus keys", () => {
    expect(
      directoryKey({
        scope: "department",
        campusId: "1",
        departmentId: "7",
        role: "finance",
      })
    ).toBe("dept:7:finance");
    expect(
      directoryKey({ scope: "campus", campusId: "2", role: "president" })
    ).toBe("campus:2:president");
  });
});

describe("directory defaults", () => {
  it("has default controllers, the national manager and no presidents", () => {
    expect(DEFAULT_DIRECTORY_EMAILS["1"]?.controller).toBe(
      "controller.oslo@biso.no"
    );
    expect(DEFAULT_DIRECTORY_EMAILS["4"]?.controller).toBe(
      "controller.stavanger@biso.no"
    );
    expect(DEFAULT_DIRECTORY_EMAILS["5"]?.national).toBe(
      NATIONAL_APPROVER_EMAIL
    );
    expect(NATIONAL_APPROVER_EMAIL).toBe("manager@biso.no");
    expect(CAMPUS_MAILBOX_SLUGS["3"]).toEqual(["trondheim", "trd"]);
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
