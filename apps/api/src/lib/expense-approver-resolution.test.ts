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

import {
  forgetLookupMisses,
  resolveExpenseApprovers,
} from "./expense-approver-resolution";

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

const HOUR_MS = 60 * 60 * 1000;

beforeEach(() => {
  forgetLookupMisses();
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
      fallbackFor: "president",
      role: "national",
      directoryKey: "campus:5:national",
      source: "default",
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
    // A directory row still shows as the fallback it is.
    expect(result.steps[0]).toMatchObject({
      email: "nat@biso.no",
      fallbackFor: "president",
      source: "default",
    });
    expect(result.issues[0]?.reason).toContain("nat@biso.no");
  });

  it("marks no fallback on a national expense", async () => {
    const { deps } = setup();
    const result = await resolveExpenseApprovers(
      { ...base, campusId: "5", departmentId: null, departmentName: null },
      deps
    );
    expect(result.steps[0]).not.toHaveProperty("fallbackFor");
  });

  it("prefers a confident AI manager over a deputy in the directory", async () => {
    directory.find.mockImplementation(async (_db: unknown, key: string) =>
      key === "dept:d1:deputy"
        ? { email: "dep@biso.no", aadId: null, key, source: "admin" }
        : null
    );
    const { deps } = setup({ manager: "manager@biso.no" });
    const result = await resolveExpenseApprovers(asManager, deps);
    expect(result.steps[0]).toMatchObject({
      email: "manager@biso.no",
      role: "manager",
      source: "ai",
    });
    expect(directory.touch).not.toHaveBeenCalledWith({}, "dept:d1:deputy");
  });

  it("uses the deputy in the directory when no manager is found anywhere", async () => {
    directory.find.mockImplementation(async (_db: unknown, key: string) =>
      key === "dept:d1:deputy"
        ? { email: "dep@biso.no", aadId: null, key, source: "admin" }
        : null
    );
    const { deps, choose } = setup();
    const result = await resolveExpenseApprovers(asManager, deps);
    expect(result.steps[0]).toMatchObject({
      email: "dep@biso.no",
      role: "deputy",
      source: "directory",
    });
    expect(result.issues).toEqual([]);
    // The manager was asked for; the deputy came from the directory.
    expect(choose.mock.calls.map(([call]) => call.role)).toEqual(["manager"]);
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

  describe("deadline", () => {
    it("ends a stalled Graph call at the deadline with the fallback", async () => {
      const { deps, candidates, choose } = setup();
      candidates.mockImplementation(() => new Promise(() => undefined));
      const result = await resolveExpenseApprovers(asController, {
        ...deps,
        lookupTimeoutMs: 20,
      });
      expect(choose).not.toHaveBeenCalled();
      expect(result.steps).toEqual([
        expect.objectContaining({ role: "national", source: "default" }),
      ]);
      expect(result.issues[0]?.roleSought).toBe("president");
    });

    it("ends a model call that ignores the abort signal", async () => {
      const { deps, choose } = setup();
      choose.mockImplementation(() => new Promise(() => undefined));
      const result = await resolveExpenseApprovers(asManager, {
        ...deps,
        lookupTimeoutMs: 20,
      });
      expect(result.steps.map((s) => s.role)).toEqual(["controller"]);
      expect(result.issues).toHaveLength(1);
    });

    it("shares one signal between the lookup and the model", async () => {
      const { deps, choose } = setup({ manager: "manager@biso.no" });
      await resolveExpenseApprovers(asManager, {
        ...deps,
        lookupTimeoutMs: 20,
      });
      const signal = choose.mock.calls[0]?.[0].abortSignal;
      expect(signal?.aborted).toBe(false);
      await new Promise((done) => setTimeout(done, 40));
      expect(signal?.aborted).toBe(true);
    });
  });

  describe("missed lookups", () => {
    function clock(start = 1_000_000) {
      let time = start;
      return {
        now: () => time,
        advance: (ms: number) => {
          time += ms;
        },
      };
    }

    it("skips Graph and the AI for a key that found nobody", async () => {
      const time = clock();
      const { deps, candidates, choose } = setup();
      await resolveExpenseApprovers(base, { ...deps, now: time.now });
      expect(candidates).toHaveBeenCalledTimes(1);
      expect(choose).toHaveBeenCalledTimes(1);

      time.advance(HOUR_MS - 1);
      const again = await resolveExpenseApprovers(base, {
        ...deps,
        now: time.now,
      });
      expect(candidates).toHaveBeenCalledTimes(1);
      expect(choose).toHaveBeenCalledTimes(1);
      // Still falls back as before, with the issue.
      expect(again.steps.map((s) => s.role)).toEqual(["controller"]);
      expect(again.issues[0]).toMatchObject({ roleSought: "finance" });
    });

    it("looks again once the miss is an hour old", async () => {
      const time = clock();
      const { deps, candidates } = setup();
      await resolveExpenseApprovers(base, { ...deps, now: time.now });

      time.advance(HOUR_MS);
      await resolveExpenseApprovers(base, { ...deps, now: time.now });
      expect(candidates).toHaveBeenCalledTimes(2);
    });

    it("remembers a timed-out lookup as a miss", async () => {
      const time = clock();
      const { deps, candidates } = setup();
      candidates.mockImplementation(() => new Promise(() => undefined));
      const stalled = { ...deps, lookupTimeoutMs: 20, now: time.now };
      await resolveExpenseApprovers(base, stalled);
      await resolveExpenseApprovers(base, stalled);
      expect(candidates).toHaveBeenCalledTimes(1);
    });

    it("clears the miss when the lookup finds someone", async () => {
      const time = clock();
      const { deps, candidates, choose } = setup();
      await resolveExpenseApprovers(base, { ...deps, now: time.now });

      time.advance(HOUR_MS);
      choose.mockResolvedValue({
        email: "finance@biso.no",
        confidence: 0.9,
        reason: "match",
      });
      const found = await resolveExpenseApprovers(base, {
        ...deps,
        now: time.now,
      });
      expect(found.steps[0]).toMatchObject({ role: "finance", source: "ai" });

      // A later miss is remembered afresh, not from the old timestamp.
      choose.mockResolvedValue(null);
      await resolveExpenseApprovers(base, { ...deps, now: time.now });
      await resolveExpenseApprovers(base, { ...deps, now: time.now });
      expect(candidates).toHaveBeenCalledTimes(3);
    });

    it("keeps the miss per directory key", async () => {
      const time = clock();
      const { deps, candidates } = setup();
      await resolveExpenseApprovers(base, { ...deps, now: time.now });
      await resolveExpenseApprovers(
        { ...base, departmentId: "d2", departmentName: "Sales" },
        { ...deps, now: time.now }
      );
      expect(candidates).toHaveBeenCalledTimes(2);
    });
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
