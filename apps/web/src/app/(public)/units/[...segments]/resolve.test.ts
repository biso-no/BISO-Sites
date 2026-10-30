import { beforeEach, describe, expect, it, vi } from "vitest";

const findCanonicalUnit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/unit-page", () => ({ findCanonicalUnit }));
vi.mock("@/app/actions/campus", () => ({ getActiveCampus: vi.fn() }));
vi.mock("@/lib/data/public-content", () => ({
  cachedDepartmentById: vi.fn(),
  cachedDepartmentsBySlug: vi.fn(),
}));

import { resolveUnit } from "./resolve";

const FADDERULLAN = { $id: "24", Name: "OSL Fadderullan" };

describe("resolveUnit: a department's page below its unit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findCanonicalUnit.mockResolvedValue({
      canonical: "/units/oslo/fadderullan",
      department: FADDERULLAN,
    });
  });

  it("resolves to the unit's department and the page's storage slug", async () => {
    expect(await resolveUnit(["oslo", "fadderullan", "program"])).toEqual({
      department: FADDERULLAN,
      kind: "subPage",
      slug: "units/oslo/fadderullan/program",
    });
    expect(findCanonicalUnit).toHaveBeenCalledWith("oslo", "fadderullan");
  });

  it("builds the slug from the unit's canonical address", async () => {
    const resolution = await resolveUnit(["oslo", "Fadderullan", "program"]);
    expect(resolution).toMatchObject({
      slug: "units/oslo/fadderullan/program",
    });
  });

  it("is not found under an unknown unit", async () => {
    findCanonicalUnit.mockResolvedValue(null);
    expect(await resolveUnit(["oslo", "nobody", "program"])).toEqual({
      kind: "notFound",
    });
  });

  it("is not found for a name the admin can't write, or a deeper path", async () => {
    for (const segments of [
      ["oslo", "fadderullan", "Program"],
      ["oslo", "fadderullan", "a b"],
      ["oslo", "fadderullan", "a", "b"],
    ]) {
      expect(await resolveUnit(segments)).toEqual({ kind: "notFound" });
    }
  });
});
