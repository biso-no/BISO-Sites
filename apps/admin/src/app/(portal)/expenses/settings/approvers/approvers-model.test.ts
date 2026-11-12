import { describe, expect, test } from "bun:test";
import {
  canEditApproverRow,
  nameAfterEmailChange,
  normalizeApproverEmail,
} from "./approvers-model";

const global = {
  isCampusAdmin: false,
  isGlobalAdmin: true,
  managedCampusIds: [],
};
const campus = {
  isCampusAdmin: true,
  isGlobalAdmin: false,
  managedCampusIds: ["1"],
};
const nobody = {
  isCampusAdmin: false,
  isGlobalAdmin: false,
  managedCampusIds: [],
};

describe("canEditApproverRow", () => {
  test("a global admin edits any row", () => {
    expect(
      canEditApproverRow(global, { campus_id: "3", scope: "campus" })
    ).toBe(true);
    expect(
      canEditApproverRow(global, { campus_id: "5", scope: "department" })
    ).toBe(true);
  });

  test("a campus admin edits a department row of their own campus", () => {
    expect(
      canEditApproverRow(campus, { campus_id: "1", scope: "department" })
    ).toBe(true);
  });

  test("campus admin cannot edit another campus or a campus row", () => {
    expect(
      canEditApproverRow(campus, { campus_id: "2", scope: "department" })
    ).toBe(false);
    expect(
      canEditApproverRow(campus, { campus_id: "1", scope: "campus" })
    ).toBe(false);
  });

  test("everyone else edits nothing", () => {
    expect(
      canEditApproverRow(nobody, { campus_id: "1", scope: "department" })
    ).toBe(false);
  });
});

describe("normalizeApproverEmail", () => {
  test("trims and lowercases a biso address", () => {
    expect(normalizeApproverEmail("  Ola.Nordmann@BISO.no ")).toBe(
      "ola.nordmann@biso.no"
    );
  });

  test("refuses other domains and malformed input", () => {
    expect(normalizeApproverEmail("ola@gmail.com")).toBeNull();
    expect(normalizeApproverEmail("ola@biso.no.evil.com")).toBeNull();
    expect(normalizeApproverEmail("@biso.no")).toBeNull();
    expect(normalizeApproverEmail("")).toBeNull();
  });
});

describe("nameAfterEmailChange", () => {
  const draft = {
    displayName: "Ola Nordmann",
    nameTouched: false,
    originalEmail: "ola@biso.no",
    originalName: "Ola Nordmann",
  };

  test("clears the prefilled name when the email changes", () => {
    expect(nameAfterEmailChange(draft, "kari@biso.no")).toBe("");
  });

  test("brings the name back when the email is changed back", () => {
    expect(
      nameAfterEmailChange({ ...draft, displayName: "" }, " OLA@biso.no")
    ).toBe("Ola Nordmann");
  });

  test("keeps a name the admin typed", () => {
    expect(
      nameAfterEmailChange(
        { ...draft, displayName: "Kari", nameTouched: true },
        "kari@biso.no"
      )
    ).toBe("Kari");
  });
});
