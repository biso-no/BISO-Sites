import { describe, expect, test } from "bun:test";
import {
  assertBenefitCampusWrite,
  benefitAccessFor,
  canEditBenefitCampus,
  canManageMembershipTexts,
  hasVerifiedBenefitEditorIdentity,
  isBenefitEditorEmail,
  parseBenefitEditorEmails,
} from "./benefit-access";

const ALL = ["1", "2", "3", "4", "5"];

describe("parseBenefitEditorEmails", () => {
  test("splits on commas and whitespace, lowercases", () => {
    expect(parseBenefitEditorEmails(" PR@biso.no, a@b.no\nc@d.no ")).toEqual(
      new Set(["pr@biso.no", "a@b.no", "c@d.no"])
    );
  });

  test("empty input gives an empty set", () => {
    expect(parseBenefitEditorEmails(undefined).size).toBe(0);
    expect(parseBenefitEditorEmails("").size).toBe(0);
  });
});

describe("isBenefitEditorEmail", () => {
  test("matches case-insensitively", () => {
    expect(isBenefitEditorEmail("Pr@Biso.no", "pr@biso.no")).toBe(true);
  });

  test("rejects null and unlisted emails", () => {
    expect(isBenefitEditorEmail(null, "pr@biso.no")).toBe(false);
    expect(isBenefitEditorEmail("x@biso.no", "")).toBe(false);
  });
});

describe("benefitAccessFor", () => {
  test("global admin and benefits editor get everything", () => {
    for (const role of ["globaladmin", "benefitseditor"]) {
      expect(benefitAccessFor({ managedCampusIds: [], roles: [role] })).toEqual(
        { editableCampusIds: ALL, visibleCampusIds: ALL }
      );
    }
  });

  test("campus admin edits own campus and sees national", () => {
    expect(
      benefitAccessFor({ managedCampusIds: ["2"], roles: ["campusadmin"] })
    ).toEqual({ editableCampusIds: ["2"], visibleCampusIds: ["2", "5"] });
    expect(
      benefitAccessFor({ managedCampusIds: ["5", "3"], roles: ["campusadmin"] })
        .editableCampusIds
    ).toEqual(["3"]);
  });

  test("others get nothing", () => {
    expect(
      benefitAccessFor({ managedCampusIds: [], roles: ["department"] })
    ).toEqual({ editableCampusIds: [], visibleCampusIds: [] });
  });
});

describe("canEditBenefitCampus / assertBenefitCampusWrite", () => {
  const campusAdmin2 = { managedCampusIds: ["2"], roles: ["campusadmin"] };

  test("canEditBenefitCampus", () => {
    const access = benefitAccessFor(campusAdmin2);
    expect(canEditBenefitCampus(access, "2")).toBe(true);
    expect(canEditBenefitCampus(access, "5")).toBe(false);
    expect(canEditBenefitCampus(access, null)).toBe(false);
  });

  test("assert throws outside editable campuses", () => {
    expect(() => assertBenefitCampusWrite(campusAdmin2, "5")).toThrow(
      "Unauthorized: no write access to this campus"
    );
    expect(() => assertBenefitCampusWrite(campusAdmin2, "2")).not.toThrow();
  });
});

describe("canManageMembershipTexts", () => {
  test("only global admin or benefits editor", () => {
    expect(canManageMembershipTexts({ roles: ["campusadmin"] })).toBe(false);
    expect(canManageMembershipTexts({ roles: ["benefitseditor"] })).toBe(true);
    expect(canManageMembershipTexts({ roles: ["globaladmin"] })).toBe(true);
  });
});

describe("hasVerifiedBenefitEditorIdentity", () => {
  const configured = "pr@biso.no";

  test("microsoft identity with a listed email is verified", () => {
    expect(
      hasVerifiedBenefitEditorIdentity(
        [{ provider: "microsoft", providerEmail: "PR@biso.no" }],
        configured
      )
    ).toBe(true);
  });

  test("microsoft identity with another email is not", () => {
    expect(
      hasVerifiedBenefitEditorIdentity(
        [{ provider: "microsoft", providerEmail: "x@biso.no" }],
        configured
      )
    ).toBe(false);
  });

  test("another provider with the listed email is not", () => {
    expect(
      hasVerifiedBenefitEditorIdentity(
        [{ provider: "google", providerEmail: "pr@biso.no" }],
        configured
      )
    ).toBe(false);
  });

  test("no identities is not", () => {
    expect(hasVerifiedBenefitEditorIdentity([], configured)).toBe(false);
  });
});
