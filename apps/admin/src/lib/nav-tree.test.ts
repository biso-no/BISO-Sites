import { describe, expect, test } from "bun:test";
import { filterNavTree, findActivePath, flattenNavTree } from "./nav-tree";

const globalAdmin = { hasDepartmentMembership: true, roles: ["globaladmin"] };
const campusAdmin = { hasDepartmentMembership: true, roles: ["campusadmin"] };
const departmentUser = { hasDepartmentMembership: true, roles: [] };
const noAccess = { hasDepartmentMembership: false, roles: [] };

function labels(nodes: ReturnType<typeof filterNavTree>) {
  return nodes.map((n) => n.labelKey);
}

describe("filterNavTree", () => {
  test("global admin sees all 8 top-level entries", () => {
    expect(labels(filterNavTree(globalAdmin))).toEqual([
      "overview",
      "inbox",
      "content",
      "shop",
      "organization",
      "analytics",
      "system",
    ]);
  });

  test("campus admin: system group flattens to its single visible child (activity)", () => {
    const nodes = filterNavTree(campusAdmin);
    const last = nodes.at(-1);
    expect(last?.kind).toBe("leaf");
    expect(last?.labelKey).toBe("activity");
    // analytics is globaladmin-only and must be gone
    expect(labels(nodes)).not.toContain("analytics");
  });

  test("department user sees only the content group with pages/news/jobs", () => {
    const nodes = filterNavTree(departmentUser);
    expect(nodes).toHaveLength(1);
    const content = nodes[0];
    if (content?.kind !== "group") {
      throw new Error("expected content group");
    }
    expect(content.children.map((c) => c.labelKey)).toEqual([
      "pages",
      "news",
      "jobs",
    ]);
  });

  test("SECURITY: user with no roles and no membership sees nothing", () => {
    expect(filterNavTree(noAccess)).toEqual([]);
  });
});

describe("flattenNavTree", () => {
  test("returns every leaf exactly once", () => {
    const paths = flattenNavTree().map((l) => l.path);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toContain("/settings/feature-flags");
    expect(paths).toContain("/inbox");
  });
});

describe("findActivePath", () => {
  test("root only matches exactly", () => {
    expect(findActivePath("/")).toBe("/");
    expect(findActivePath("/jobs")).toBe("/jobs");
  });

  test("longest prefix wins for settings children", () => {
    expect(findActivePath("/settings/feature-flags")).toBe(
      "/settings/feature-flags"
    );
    expect(findActivePath("/settings")).toBe("/settings");
    expect(findActivePath("/settings/payments/foo")).toBe("/settings/payments");
  });

  test("detail routes match their section", () => {
    expect(findActivePath("/jobs/abc123")).toBe("/jobs");
    expect(findActivePath("/inbox/submissions/contact")).toBe("/inbox");
  });

  test("unknown path returns null", () => {
    expect(findActivePath("/nope")).toBeNull();
  });
});
