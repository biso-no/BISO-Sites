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

  it("uses the latest expiry when several memberships match (descending order)", () => {
    const gate = resolveMembershipGate(
      input({
        status: {
          isMember: true,
          memberships: [
            { expiryDate: "2029-06-30" },
            { expiryDate: "2026-12-31" },
          ],
        },
      })
    );
    expect(gate.currentExpiry).toBe("2029-06-30");
    expect(gate.offeredPlans).toEqual([]);
  });

  it("reports already_member when the catalog is empty and user is a member", () => {
    const gate = resolveMembershipGate(
      input({
        plans: [],
        status: { isMember: true, memberships: [{ expiryDate: "2026-12-31" }] },
      })
    );
    expect(gate.state).toBe("already_member");
    expect(gate.currentExpiry).toBe("2026-12-31");
  });

  it("reports no_plans_available when the catalog is empty and user is not a member", () => {
    const gate = resolveMembershipGate(input({ plans: [] }));
    expect(gate.state).toBe("no_plans_available");
    expect(gate.offeredPlans).toEqual([]);
    expect(gate.currentExpiry).toBeNull();
  });

  it("requires sign in even if other checks would fail", () => {
    expect(
      resolveMembershipGate(
        input({
          isAuthenticated: false,
          studentId: null,
          employeeId: null,
        })
      ).state
    ).toBe("signed_out");
  });

  it("requires BI link even if employee ID is also missing", () => {
    expect(
      resolveMembershipGate(
        input({
          studentId: null,
          employeeId: null,
        })
      ).state
    ).toBe("needs_bi_link");
  });

  it("requires directory record even if catalog is empty", () => {
    expect(
      resolveMembershipGate(
        input({
          employeeId: null,
          plans: [],
        })
      ).state
    ).toBe("needs_directory_record");
  });

  it("routes a transient Finago failure to membership_check_unavailable instead of the catalog", () => {
    const gate = resolveMembershipGate(
      input({
        status: {
          isMember: false,
          memberships: [],
          reason: "finago_error",
        },
      })
    );
    expect(gate.state).toBe("membership_check_unavailable");
    expect(gate.offeredPlans).toEqual([]);
    expect(gate.currentExpiry).toBeNull();
  });

  it("routes an unexpected status-resolution error to membership_check_unavailable too", () => {
    expect(
      resolveMembershipGate(
        input({
          status: {
            isMember: false,
            memberships: [],
            reason: "unexpected_error",
          },
        })
      ).state
    ).toBe("membership_check_unavailable");
  });

  it("does NOT treat a legitimate no_categories result as unavailable — falls through to the catalog", () => {
    // no_categories is a real, cacheable "not a member" result, not a
    // transient failure — must not be confused with finago_error/
    // unexpected_error.
    const gate = resolveMembershipGate(
      input({
        status: {
          isMember: false,
          memberships: [],
          reason: "no_categories",
        },
      })
    );
    expect(gate.state).toBe("eligible");
    expect(gate.offeredPlans).toEqual(plans);
  });

  it("prioritizes the transient-failure state over an existing member's own status, so an outage can't be paid over", () => {
    // The scenario the finding describes: an existing member must not see the
    // full catalog (with currentExpiry defaulting to null) during a Finago
    // outage and risk buying overlapping cover.
    const gate = resolveMembershipGate(
      input({
        status: {
          isMember: true,
          memberships: [{ expiryDate: "2026-12-31" }],
          reason: "finago_error",
        },
      })
    );
    expect(gate.state).toBe("membership_check_unavailable");
    expect(gate.currentExpiry).toBeNull();
  });

  it("requires directory record even during a transient status failure", () => {
    expect(
      resolveMembershipGate(
        input({
          employeeId: null,
          status: { isMember: false, memberships: [], reason: "finago_error" },
        })
      ).state
    ).toBe("needs_directory_record");
  });
});
