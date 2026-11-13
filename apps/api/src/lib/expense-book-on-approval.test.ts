import { beforeEach, describe, expect, it, vi } from "vitest";

const scheduled = vi.hoisted(() => ({
  tasks: [] as (() => Promise<void>)[],
}));
const flags = vi.hoisted(() => ({ isFeatureEnabled: vi.fn() }));
const posting = vi.hoisted(() => ({ postApprovedExpense: vi.fn() }));

vi.mock("next/server", () => ({
  after: (task: () => Promise<void>) => {
    scheduled.tasks.push(task);
  },
}));
vi.mock("@repo/shared/utils/feature-flags-server", () => flags);
vi.mock("./expense-posting", () => posting);

import {
  approvedLastStep,
  bookAfterFinalApproval,
} from "./expense-book-on-approval";

const finalApproval = {
  decision: "approved" as const,
  expenseId: "expense-1",
  finalized: true,
  ok: true as const,
  reimbursementNumber: "10042",
};

async function runScheduled(): Promise<void> {
  for (const task of scheduled.tasks.splice(0)) {
    await task();
  }
}

beforeEach(() => {
  scheduled.tasks.length = 0;
  flags.isFeatureEnabled.mockReset().mockResolvedValue(true);
  posting.postApprovedExpense.mockReset().mockResolvedValue(undefined);
});

describe("approvedLastStep", () => {
  it("is true only for an approval that finished the chain", () => {
    expect(approvedLastStep(finalApproval)).toBe(true);
    expect(approvedLastStep({ ...finalApproval, finalized: false })).toBe(
      false
    );
    expect(approvedLastStep({ ...finalApproval, decision: "rejected" })).toBe(
      false
    );
    expect(
      approvedLastStep({ code: "invalid_link", error: "x", ok: false })
    ).toBe(false);
  });
});

describe("bookAfterFinalApproval", () => {
  it("books the expense after the response once the last step approves", async () => {
    bookAfterFinalApproval(finalApproval);

    expect(posting.postApprovedExpense).not.toHaveBeenCalled();
    await runScheduled();
    expect(flags.isFeatureEnabled).toHaveBeenCalledWith(
      "expenses_ledger_posting"
    );
    expect(posting.postApprovedExpense).toHaveBeenCalledWith("expense-1");
  });

  it("does nothing for an earlier step, a rejection or a refused decision", () => {
    bookAfterFinalApproval({ ...finalApproval, finalized: false });
    bookAfterFinalApproval({
      ...finalApproval,
      decision: "rejected",
    });
    bookAfterFinalApproval({ code: "link_expired", error: "x", ok: false });

    expect(scheduled.tasks).toHaveLength(0);
  });

  it("leaves the expense for later while ledger posting is off", async () => {
    flags.isFeatureEnabled.mockResolvedValue(false);

    bookAfterFinalApproval(finalApproval);
    await runScheduled();

    expect(posting.postApprovedExpense).not.toHaveBeenCalled();
  });

  it("only logs a failed booking, which the posting has already recorded", async () => {
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    posting.postApprovedExpense.mockRejectedValue(new Error("Finago down"));

    bookAfterFinalApproval(finalApproval);
    await expect(runScheduled()).resolves.toBeUndefined();

    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
