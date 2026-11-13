import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const approval = vi.hoisted(() => ({
  decideApproval: vi.fn(),
  getApprovalContext: vi.fn(),
}));

const booking = vi.hoisted(() => ({ bookAfterFinalApproval: vi.fn() }));

vi.mock("@/lib/expense-approval", () => approval);
vi.mock("@/lib/expense-book-on-approval", () => booking);

import { POST } from "./route";

const call = (body: unknown) =>
  POST(
    new NextRequest("http://localhost/api/expenses/approve", {
      body: JSON.stringify(body),
      method: "POST",
    })
  );

beforeEach(() => {
  approval.decideApproval.mockReset();
  booking.bookAfterFinalApproval.mockReset();
});

describe("POST /api/expenses/approve", () => {
  it("returns the stable code with a refused decision", async () => {
    approval.decideApproval.mockResolvedValue({
      code: "account_missing",
      error: "A receipt has no account yet. Set it in admin before approving.",
      ok: false,
    });

    const res = await call({ decision: "approved", token: "raw-token" });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      code: "account_missing",
      error: "A receipt has no account yet. Set it in admin before approving.",
    });
    expect(booking.bookAfterFinalApproval).not.toHaveBeenCalled();
  });

  it("hands a recorded decision to the booking trigger", async () => {
    const result = {
      decision: "approved",
      expenseId: "expense-1",
      finalized: true,
      ok: true,
      reimbursementNumber: "10042",
    };
    approval.decideApproval.mockResolvedValue(result);

    const res = await call({ decision: "approved", token: "raw-token" });

    expect(res.status).toBe(200);
    expect(booking.bookAfterFinalApproval).toHaveBeenCalledWith(result);
  });
});
