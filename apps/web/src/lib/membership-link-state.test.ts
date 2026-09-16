import { describe, expect, it } from "vitest";
import { resolveMembershipLinkState } from "./membership-link-state";

describe("resolveMembershipLinkState", () => {
  it("walks sign-in, link, directory record, then linked", () => {
    expect(
      resolveMembershipLinkState({
        employeeId: null,
        isAuthenticated: false,
        studentId: null,
      })
    ).toBe("signed_out");
    expect(
      resolveMembershipLinkState({
        employeeId: null,
        isAuthenticated: true,
        studentId: null,
      })
    ).toBe("needs_bi_link");
    expect(
      resolveMembershipLinkState({
        employeeId: null,
        isAuthenticated: true,
        studentId: "s1715738",
      })
    ).toBe("needs_directory_record");
    expect(
      resolveMembershipLinkState({
        employeeId: "1015882",
        isAuthenticated: true,
        studentId: "s1715738",
      })
    ).toBe("linked");
  });
});
