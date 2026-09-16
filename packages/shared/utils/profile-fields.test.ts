import { describe, expect, it } from "vitest";
import {
  buildProfileRowPermissions,
  pickSelfServiceProfileFields,
  selfServiceProfileSchema,
} from "./profile-fields";

describe("profile self-service fields", () => {
  it("keeps editable fields and drops identity and role columns", () => {
    expect(
      pickSelfServiceProfileFields({
        bank_account: "12345678903",
        bi_employee_id: "1015882",
        campus_id: "1",
        name: "Ada",
        roles: ["globaladmin"],
        student_id: "s1715738",
      } as never)
    ).toEqual({ bank_account: "12345678903", campus_id: "1", name: "Ada" });
  });

  it("strips unknown keys and enforces the table's column lengths", () => {
    const parsed = selfServiceProfileSchema.safeParse({
      departments: ["dept-1"],
      name: "Ada",
      student_id: "s1715738",
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data).toEqual({
      departments: ["dept-1"],
      name: "Ada",
    });

    expect(
      selfServiceProfileSchema.safeParse({ name: "x".repeat(31) }).success
    ).toBe(false);
    expect(selfServiceProfileSchema.safeParse({ zip: 1234 }).success).toBe(
      false
    );
  });

  it("makes a profile row readable by its owner only", () => {
    expect(buildProfileRowPermissions("user-1")).toEqual([
      'read("user:user-1")',
    ]);
  });
});
