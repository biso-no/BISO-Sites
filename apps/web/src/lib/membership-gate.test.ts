import type { MembershipPlan } from "@repo/shared/utils/membership-plans";
import { describe, expect, it } from "vitest";
import { resolveMembershipGate } from "./membership-gate";

const semester: MembershipPlan = {
  id: "54",
  name: "BISO Membership fall 2026",
  price: 350,
  productId: 54,
  categoryId: 113_176,
  duration: "semester",
  accrualMonths: 6,
  startDate: "2026-08-01",
  expiryDate: "2026-12-31",
};
const threeYears: MembershipPlan = {
  ...semester,
  id: "82",
  productId: 82,
  categoryId: 113_177,
  duration: "three_years",
  accrualMonths: 36,
  price: 1350,
  expiryDate: "2029-06-30",
};
const plans = [semester, threeYears];

function input(overrides: Record<string, unknown> = {}) {
  return {
    isAuthenticated: true,
    studentId: "s1715738",
    employeeId: "9001234",
    status: { isMember: false, memberships: [] },
    plans,
    ...overrides,
  };
}

describe("resolveMembershipGate", () => {
  it("requires sign in first", () => {
    expect(resolveMembershipGate(input({ isAuthenticated: false })).state).toBe(
      "signed_out"
    );
  });

  it("requires a linked BI account", () => {
    expect(resolveMembershipGate(input({ studentId: null })).state).toBe(
      "needs_bi_link"
    );
  });

  it("requires an Azure employee id before taking payment", () => {
    expect(resolveMembershipGate(input({ employeeId: null })).state).toBe(
      "needs_directory_record"
    );
  });

  it("is eligible with everything present", () => {
    const gate = resolveMembershipGate(input());
    expect(gate.state).toBe("eligible");
    expect(gate.offeredPlans).toEqual(plans);
    expect(gate.currentExpiry).toBeNull();
  });

  it("offers only plans that extend an existing membership", () => {
    const gate = resolveMembershipGate(
      input({
        status: {
          isMember: true,
          memberships: [{ expiryDate: "2026-12-31" }],
        },
      })
    );
    expect(gate.state).toBe("eligible");
    expect(gate.currentExpiry).toBe("2026-12-31");
    expect(gate.offeredPlans).toEqual([threeYears]);
  });

  it("reports already_member when no plan would extend cover", () => {
    const gate = resolveMembershipGate(
      input({
        status: {
          isMember: true,
          memberships: [{ expiryDate: "2030-01-01" }],
        },
      })
    );
    expect(gate.state).toBe("already_member");
    expect(gate.offeredPlans).toEqual([]);
  });

  it("uses the latest expiry when several memberships match", () => {
    const gate = resolveMembershipGate(
      input({
        status: {
          isMember: true,
          memberships: [
            { expiryDate: "2026-12-31" },
            { expiryDate: "2029-06-30" },
          ],
        },
      })
    );
    expect(gate.currentExpiry).toBe("2029-06-30");
    expect(gate.offeredPlans).toEqual([]);
  });

  it("reports already_member when the catalog is empty", () => {
    const gate = resolveMembershipGate(input({ plans: [] }));
    expect(gate.state).toBe("already_member");
  });
});
