import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const approval = vi.hoisted(() => ({ decideApprovalStep: vi.fn() }));
const auth = vi.hoisted(() => ({ isInternalRequest: vi.fn() }));

vi.mock("@/lib/expense-approval", () => approval);
vi.mock("@/lib/internal-auth", () => auth);

import { POST } from "./route";

const VALID = {
  actor: { email: "admin@biso.no", kind: "admin", name: "Admin" },
  approvalId: "approval-1",
  decision: "approved",
  onBehalf: true,
};

const call = (body: unknown) =>
  POST(
    new NextRequest("http://localhost/api/expenses/admin/decide", {
      body: JSON.stringify(body),
      method: "POST",
    })
  );

beforeEach(() => {
  approval.decideApprovalStep.mockReset();
  auth.isInternalRequest.mockReset().mockReturnValue(true);
});

describe("POST /api/expenses/admin/decide", () => {
  it("returns 401 without the internal secret", async () => {
    auth.isInternalRequest.mockReturnValue(false);

    const res = await call(VALID);

    expect(res.status).toBe(401);
    expect(approval.decideApprovalStep).not.toHaveBeenCalled();
  });

  it("returns 400 for a rejection without a reason", async () => {
    for (const reason of [undefined, "   "]) {
      const res = await call({ ...VALID, decision: "rejected", reason });
      expect(res.status).toBe(400);
    }
    expect(approval.decideApprovalStep).not.toHaveBeenCalled();
  });

  it("returns 400 for a malformed body", async () => {
    const res = await call({ ...VALID, actor: { ...VALID.actor, name: "" } });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("invalid_body");
    expect(approval.decideApprovalStep).not.toHaveBeenCalled();
  });

  it("returns 400 when the decision is refused", async () => {
    approval.decideApprovalStep.mockResolvedValue({
      code: "not_current_step",
      error: "This step is not waiting for a decision.",
      ok: false,
    });

    const res = await call(VALID);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      code: "not_current_step",
      error: "This step is not waiting for a decision.",
    });
  });

  it("returns 200 with the result on success", async () => {
    const result = {
      decision: "approved",
      expenseId: "expense-1",
      finalized: false,
      ok: true,
      reimbursementNumber: "10042",
    };
    approval.decideApprovalStep.mockResolvedValue(result);

    const res = await call(VALID);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ result });
    expect(approval.decideApprovalStep).toHaveBeenCalledWith(VALID);
  });
});
