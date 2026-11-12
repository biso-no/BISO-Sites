import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const approval = vi.hoisted(() => ({
  decideApproval: vi.fn(),
  getApprovalContext: vi.fn(),
}));

vi.mock("@/lib/expense-approval", () => approval);

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
  });
});
