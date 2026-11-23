import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const approval = vi.hoisted(() => ({ rebuildApprovalChain: vi.fn() }));
const auth = vi.hoisted(() => ({ isInternalRequest: vi.fn() }));
const flags = vi.hoisted(() => ({ isFeatureEnabled: vi.fn() }));

vi.mock("@/lib/expense-approval", () => approval);
vi.mock("@/lib/internal-auth", () => auth);
vi.mock("@repo/shared/utils/feature-flags-server", () => flags);

import { POST } from "./route";

const VALID = {
  actor: { email: "admin@biso.no", kind: "admin", name: "Admin" },
  expenseId: "expense-1",
};

const call = (body: unknown) =>
  POST(
    new NextRequest("http://localhost/api/expenses/admin/rebuild-chain", {
      body: JSON.stringify(body),
      method: "POST",
    })
  );

beforeEach(() => {
  approval.rebuildApprovalChain.mockReset();
  auth.isInternalRequest.mockReset().mockReturnValue(true);
  flags.isFeatureEnabled.mockReset().mockResolvedValue(true);
});

describe("POST /api/expenses/admin/rebuild-chain", () => {
  it("returns 401 without the internal secret", async () => {
    auth.isInternalRequest.mockReturnValue(false);

    expect((await call(VALID)).status).toBe(401);
    expect(approval.rebuildApprovalChain).not.toHaveBeenCalled();
  });

  it("refuses with posting_disabled while direct booking is off", async () => {
    flags.isFeatureEnabled.mockResolvedValue(false);

    const res = await call(VALID);

    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: "posting_disabled" });
    expect(flags.isFeatureEnabled).toHaveBeenCalledWith(
      "expenses_ledger_posting"
    );
    expect(approval.rebuildApprovalChain).not.toHaveBeenCalled();
  });

  it("returns 400 with the code when the rebuild is refused", async () => {
    approval.rebuildApprovalChain.mockResolvedValue({
      code: "not_rebuildable",
      error: "nope",
      ok: false,
    });

    const res = await call(VALID);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      code: "not_rebuildable",
      error: "nope",
    });
  });

  it("returns 200 with the step count on success", async () => {
    approval.rebuildApprovalChain.mockResolvedValue({
      ok: true,
      stepsCreated: 2,
    });

    const res = await call(VALID);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ result: { ok: true, stepsCreated: 2 } });
  });
});
