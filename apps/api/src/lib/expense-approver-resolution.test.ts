import { beforeEach, describe, expect, it, vi } from "vitest";

const directory = vi.hoisted(() => ({
  find: vi.fn(),
  save: vi.fn(),
  touch: vi.fn(),
}));
vi.mock("./expense-approver-directory", () => ({
  findDirectoryApprover: directory.find,
  saveDirectoryApprover: directory.save,
  touchDirectoryApprover: directory.touch,
}));
vi.mock("@repo/api/server", () => ({ createAdminClient: vi.fn() }));
const getGraphService = vi.hoisted(() => vi.fn());
vi.mock("./graph", () => ({ getGraphService }));

import { resolveExpenseApprovers } from "./expense-approver-resolution";

const candidate = (email: string) => ({
  aadId: `id-${email}`,
  department: null,
  displayName: email,
  email,
});

const base = {
  campusId: "1",
  campusName: "Oslo",
  departmentId: "d1",
  departmentName: "Marketing",
  submitterIsFinancialManager: false,
  submitterIsController: false,
};

function setup(answers: Record<string, string | null> = {}) {
  const candidates = vi.fn(async (_graph: unknown, input: { role: string }) => [
    candidate(`${input.role}@biso.no`),
  ]);
  const choose = vi.fn((input: { role: string; abortSignal?: AbortSignal }) => {
    const email = answers[input.role];
    return Promise.resolve(
      email ? { email, confidence: 0.9, reason: "match" } : null
    );
  });
  return {
    candidates,
    choose,
    deps: {
      db: {} as never,
      graph: {} as never,
      candidates: candidates as never,
      choose: choose as never,
    },
  };
}

const asManager = { ...base, submitterIsFinancialManager: true };
const asController = {
  ...base,
  departmentId: "1",
  departmentName: "Ledelsen",
  submitterIsController: true,
};

beforeEach(() => {
  getGraphService.mockReset().mockReturnValue({});
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  directory.find.mockReset().mockResolvedValue(null);
  directory.save.mockReset().mockResolvedValue(undefined);
  directory.touch.mockReset().mockResolvedValue(undefined);
});

describe("resolveExpenseApprovers", () => {
  it("uses the directory before asking the AI", async () => {
    directory.find.mockImplementation(async (_db: unknown, key: string) =>
      key === "dept:d1:manager"
        ? { email: "m@biso.no", aadId: "a1", key, source: "admin" }
        : null
    );
    const { deps, choose } = setup();
    const result = await resolveExpenseApprovers(asManager, deps);
    expect(choose).not.toHaveBeenCalled();
    expect(result.steps[0]).toMatchObject({
      email: "m@biso.no",
      role: "manager",
      directoryKey: "dept:d1:manager",
      source: "directory",
    });
    expect(directory.touch).toHaveBeenCalledWith({}, "dept:d1:manager");
  });

  it("saves a confident AI answer to the directory", async () => {
    const { deps, choose } = setup({ manager: "manager@biso.no" });
    const result = await resolveExpenseApprovers(asManager, deps);
    expect(result.steps[0]).toMatchObject({
      email: "manager@biso.no",
      source: "ai",
      aadId: "id-manager@biso.no",
    });
    expect(directory.save).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        key: "dept:d1:manager",
        email: "manager@biso.no",
        source: "ai",
        confidence: 0.9,
      })
    );
    expect(choose.mock.calls[0]?.[0].abortSignal).toBeInstanceOf(AbortSignal);
  });

  it("ignores an answer below 0.8 confidence", async () => {
    const { deps, choose } = setup();
    choose.mockResolvedValue({
      email: "x@biso.no",
      confidence: 0.7,
      reason: "",
    });
    const result = await resolveExpenseApprovers(asManager, deps);
    expect(result.steps.map((s) => s.role)).toEqual(["controller"]);
    expect(result.issues).toHaveLength(1);
  });

  it("falls back from manager to deputy", async () => {
    const { deps } = setup({ deputy: "dep@biso.no" });
    const result = await resolveExpenseApprovers(asManager, deps);
    expect(result.steps[0]).toMatchObject({
      email: "dep@biso.no",
      role: "deputy",
      directoryKey: "dept:d1:deputy",
    });
    expect(result.issues).toEqual([]);
  });

  it("drops the department step with an issue when nobody is found", async () => {
    const { deps } = setup();
    const result = await resolveExpenseApprovers(asManager, deps);
    expect(result.steps.map((s) => s.role)).toEqual(["controller"]);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({
      campusId: "1",
      department: "Marketing",
      roleSought: "manager",
    });
  });

  it("seeds the controller default", async () => {
    const { deps } = setup({ manager: "manager@biso.no" });
    const result = await resolveExpenseApprovers(asManager, deps);
    const controller = result.steps.at(-1);
    expect(controller).toMatchObject({
      role: "controller",
      email: "controller.oslo@biso.no",
      directoryKey: "campus:1:controller",
      source: "default",
    });
    expect(directory.save).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        key: "campus:1:controller",
        source: "seed",
        scope: "campus",
      })
    );
  });

  it("routes a controller's own expense to the president", async () => {
    const { deps } = setup({ president: "pres@biso.no" });
    const result = await resolveExpenseApprovers(asController, deps);
    expect(result.steps.map((s) => s.role)).toEqual(["president"]);
    expect(result.steps[0]).toMatchObject({
      email: "pres@biso.no",
      directoryKey: "campus:1:president",
    });
  });

  it("falls back to the national approver when no president is found", async () => {
    const { deps } = setup();
    const result = await resolveExpenseApprovers(asController, deps);
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]).toMatchObject({
      email: "manager@biso.no",
      role: "national",
      directoryKey: "campus:5:national",
    });
    expect(result.steps.some((s) => s.role === "controller")).toBe(false);
    expect(result.issues[0]).toMatchObject({ roleSought: "president" });
  });

  it("treats a failing or timed-out AI call as not found", async () => {
    const { deps, choose } = setup();
    choose.mockRejectedValue(new Error("aborted"));
    const result = await resolveExpenseApprovers(base, deps);
    expect(result.steps.map((s) => s.role)).toEqual(["controller"]);
  });

  it("numbers steps after a drop", async () => {
    const { deps } = setup();
    const result = await resolveExpenseApprovers(asManager, deps);
    expect(result.steps.map((s) => s.step)).toEqual([1]);
  });

  it("accepts exactly 0.8 confidence", async () => {
    const { deps, choose } = setup();
    choose.mockResolvedValue({
      email: "manager@biso.no",
      confidence: 0.8,
      reason: "",
    });
    const result = await resolveExpenseApprovers(asManager, deps);
    expect(result.steps[0]).toMatchObject({ source: "ai" });
  });

  it("treats a rejected candidates call as not found", async () => {
    const { deps, candidates } = setup();
    candidates.mockRejectedValue(new Error("graph down"));
    const result = await resolveExpenseApprovers(asManager, deps);
    expect(result.steps.map((s) => s.role)).toEqual(["controller"]);
    expect(result.issues).toHaveLength(1);
  });

  it("skips the seed save when the controller is in the directory", async () => {
    directory.find.mockImplementation(async (_db: unknown, key: string) =>
      key === "campus:2:controller"
        ? { email: "c@biso.no", aadId: null, key, source: "admin" }
        : null
    );
    const { deps } = setup();
    const result = await resolveExpenseApprovers(
      { ...base, campusId: "2", departmentId: "50", departmentName: "X" },
      deps
    );
    expect(result.steps[0]).toMatchObject({
      email: "c@biso.no",
      source: "directory",
    });
    expect(directory.save).not.toHaveBeenCalled();
  });

  it("skips the AI when the president is in the directory", async () => {
    directory.find.mockImplementation(async (_db: unknown, key: string) =>
      key === "campus:1:president"
        ? { email: "p@biso.no", aadId: null, key, source: "confirmed" }
        : null
    );
    const { deps, choose } = setup();
    const result = await resolveExpenseApprovers(asController, deps);
    expect(choose).not.toHaveBeenCalled();
    expect(result.steps[0]).toMatchObject({ email: "p@biso.no" });
  });

  it("names the national mailbox actually used in the fallback issue", async () => {
    directory.find.mockImplementation(async (_db: unknown, key: string) =>
      key === "campus:5:national"
        ? { email: "nat@biso.no", aadId: null, key, source: "admin" }
        : null
    );
    const { deps } = setup();
    const result = await resolveExpenseApprovers(asController, deps);
    expect(result.steps[0]).toMatchObject({ email: "nat@biso.no" });
    expect(result.issues[0]?.reason).toContain("nat@biso.no");
  });

  it("prefers a confident manager over a deputy", async () => {
    const { deps } = setup({
      manager: "manager@biso.no",
      deputy: "deputy@biso.no",
    });
    const result = await resolveExpenseApprovers(asManager, deps);
    expect(result.steps[0]?.role).toBe("manager");
    expect(directory.save).not.toHaveBeenCalledWith(
      {},
      expect.objectContaining({ role: "deputy" })
    );
  });

  describe("without Graph configured", () => {
    beforeEach(() => {
      getGraphService.mockImplementation(() => {
        throw new Error("Azure credentials missing");
      });
    });
    const noGraph = (choose?: unknown) => ({
      db: {} as never,
      ...(choose ? { choose: choose as never } : {}),
    });

    it("still resolves a Bergen controller-only expense", async () => {
      const result = await resolveExpenseApprovers(
        { ...base, campusId: "2", departmentId: "50", departmentName: "X" },
        noGraph()
      );
      expect(result.steps.map((s) => s.role)).toEqual(["controller"]);
    });

    it("still resolves a national expense", async () => {
      const result = await resolveExpenseApprovers(
        { ...base, campusId: "5", departmentId: null, departmentName: null },
        noGraph()
      );
      expect(result.steps.map((s) => s.role)).toEqual(["national"]);
    });

    it("falls back to national when the president lookup cannot reach Graph", async () => {
      const result = await resolveExpenseApprovers(asController, noGraph());
      expect(result.steps.map((s) => s.role)).toEqual(["national"]);
      expect(result.issues[0]?.roleSought).toBe("president");
    });
  });
});
