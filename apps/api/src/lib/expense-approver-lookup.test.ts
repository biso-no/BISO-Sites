import { beforeEach, describe, expect, it, vi } from "vitest";

const generateObject = vi.hoisted(() => vi.fn());
vi.mock("ai", () => ({ generateObject }));
vi.mock("@repo/ai/models", () => ({ fastModel: "fast" }));

import {
  chooseApprover,
  departmentMailboxHints,
  findApproverCandidates,
} from "./expense-approver-lookup";

const user = (mail: string, department: string | null = null) => ({
  id: `id-${mail}`,
  displayName: mail.split("@")[0],
  mail,
  userPrincipalName: mail,
  department,
});

function graphWith(opts: {
  byDepartment?: ReturnType<typeof user>[];
  search?: Record<string, ReturnType<typeof user>[]>;
}) {
  return {
    findUsersByDepartment: vi.fn(async () => opts.byDepartment ?? []),
    searchUsers: vi.fn(
      async (query: string) => opts.search?.[query.toLowerCase()] ?? []
    ),
  } as never;
}

beforeEach(() => {
  generateObject.mockReset();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("departmentMailboxHints", () => {
  it("uses both parts and the initials of a multi-word part", () => {
    const hints = departmentMailboxHints(
      "OSL BBA - Bachelor of Business Administration"
    );
    expect(hints).toContain("bba");
    expect(hints).toContain("business");
    expect(hints).toContain("boba");
  });

  it("folds Norwegian letters and skips initials for one word", () => {
    expect(departmentMailboxHints("OSL Næringslivsutvalget")).toEqual([
      "naeringslivsutvalget",
    ]);
  });

  it("keeps short words of a name", () => {
    const hints = departmentMailboxHints("OSL AI Club");
    expect(hints).toContain("ai");
    expect(hints).toContain("club");
  });
});

describe("findApproverCandidates", () => {
  it("finds finance candidates by department and by mailbox", async () => {
    const graph = graphWith({
      byDepartment: [
        user("finance.nu.oslo@biso.no", "OSL Næringslivsutvalget"),
        user("manager.nu.oslo@biso.no", "OSL Næringslivsutvalget"),
      ],
      search: {
        "finance.": [
          user("finance.nu.oslo@biso.no"),
          user("finance.nu.bergen@biso.no"),
        ],
        "financial.": [
          user("financial.nu.oslo@biso.no", "OSL Næringslivsutvalget"),
        ],
      },
    });
    const result = await findApproverCandidates(graph, {
      role: "finance",
      campusId: "1",
      departmentName: "OSL Næringslivsutvalget",
    });
    expect(result.map((c) => c.email).sort()).toEqual([
      "finance.nu.oslo@biso.no",
      "financial.nu.oslo@biso.no",
    ]);
  });

  it("matches Trondheim's trd mailboxes case-insensitively", async () => {
    const graph = graphWith({
      search: {
        "finance.": [
          user("Finance.nu.trd@biso.no"),
          user("finance.nu.oslo@biso.no"),
        ],
      },
    });
    const result = await findApproverCandidates(graph, {
      role: "finance",
      campusId: "3",
      departmentName: "TRD NU Club",
    });
    expect(result.map((c) => c.email)).toEqual(["Finance.nu.trd@biso.no"]);
  });

  it("returns no candidates when Graph fails", async () => {
    const graph = {
      findUsersByDepartment: vi.fn().mockRejectedValue(new Error("x")),
      searchUsers: vi.fn().mockRejectedValue(new Error("x")),
    } as never;
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(
      await findApproverCandidates(graph, { role: "president", campusId: "1" })
    ).toEqual([]);
  });
});

const candidates = [
  {
    email: "finance.nu.oslo@biso.no",
    displayName: "Finance NU",
    department: null,
    aadId: "a",
  },
];
const input = {
  role: "finance" as const,
  campusName: "Oslo",
  departmentName: "OSL NU",
  candidates,
};

describe("chooseApprover", () => {
  it("returns the chosen candidate with clamped confidence", async () => {
    generateObject.mockResolvedValue({
      object: { email: "FINANCE.nu.oslo@biso.no", confidence: 3, reason: "ok" },
    });
    expect(await chooseApprover(input)).toEqual({
      email: "finance.nu.oslo@biso.no",
      confidence: 1,
      reason: "ok",
    });
  });

  it("rejects an email that is not a candidate", async () => {
    generateObject.mockResolvedValue({
      object: { email: "evil@example.com", confidence: 1, reason: "x" },
    });
    expect(await chooseApprover(input)).toBeNull();
  });

  it("returns null without calling the model when there are no candidates", async () => {
    expect(await chooseApprover({ ...input, candidates: [] })).toBeNull();
    expect(generateObject).not.toHaveBeenCalled();
  });

  it("returns null when the model fails", async () => {
    generateObject.mockRejectedValue(new Error("down"));
    expect(await chooseApprover(input)).toBeNull();
  });
});
