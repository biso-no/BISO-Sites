import { describe, expect, test } from "bun:test";
import { buildAssistantCapabilities } from "./authz";

describe("buildAssistantCapabilities benefits domain", () => {
  test("department-only users get no benefits access but keep events", () => {
    const caps = buildAssistantCapabilities({
      hasDepartmentMembership: true,
      isCampusAdmin: false,
      roles: [],
    });
    expect(caps.domains.benefits).toBe("none");
    expect(caps.domains.events).toBe("write");
  });

  test("benefits editors and admins publish benefits", () => {
    for (const role of ["benefitseditor", "globaladmin", "campusadmin"]) {
      const caps = buildAssistantCapabilities({
        hasDepartmentMembership: false,
        isCampusAdmin: false,
        roles: [role],
      });
      expect(caps.domains.benefits).toBe("publish");
    }
  });
});
