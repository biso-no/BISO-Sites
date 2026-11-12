import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const approval = vi.hoisted(() => ({ changeStepApprover: vi.fn() }));
const auth = vi.hoisted(() => ({ isInternalRequest: vi.fn() }));

vi.mock("@/lib/expense-approval", () => approval);
vi.mock("@/lib/internal-auth", () => auth);

import { POST } from "./route";

const VALID = {
  actor: { email: "admin@biso.no", kind: "admin", name: "Admin" },
  approvalId: "approval-1",
  email: "new@biso.no",
};

const call = (body: unknown) =>
  POST(
    new NextRequest("http://localhost/api/expenses/admin/change-approver", {
      body: JSON.stringify(body),
      method: "POST",
    })
  );

beforeEach(() => {
  approval.changeStepApprover.mockReset();
  auth.isInternalRequest.mockReset().mockReturnValue(true);
});

describe("POST /api/expenses/admin/change-approver", () => {
  it("returns 401 without the internal secret", async () => {
    auth.isInternalRequest.mockReturnValue(false);

    const res = await call(VALID);

    expect(res.status).toBe(401);
    expect(approval.changeStepApprover).not.toHaveBeenCalled();
  });

  it("returns 400 for a malformed body", async () => {
    for (const body of [
      { ...VALID, email: "not-an-email" },
      { ...VALID, approvalId: "" },
      { ...VALID, actor: { ...VALID.actor, name: "" } },
    ]) {
      expect((await call(body)).status).toBe(400);
    }
    expect(approval.changeStepApprover).not.toHaveBeenCalled();
  });

  it("returns 400 with invalid_email for an address outside biso.no", async () => {
    for (const email of [
      "x@gmail.com",
      "x@biso.no.evil.com",
      "x@sub.biso.no",
    ]) {
      const res = await call({ ...VALID, email });
      expect(res.status).toBe(400);
      expect((await res.json()).code).toBe("invalid_email");
    }
    expect((await call({ ...VALID, email: "New@BISO.no" })).status).not.toBe(
      400
    );
  });

  it("returns invalid_body for a malformed body", async () => {
    const res = await call({ ...VALID, approvalId: "" });
    expect((await res.json()).code).toBe("invalid_body");
  });

  it("returns 400 with the code when the change is refused", async () => {
    approval.changeStepApprover.mockResolvedValue({
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
    approval.changeStepApprover.mockResolvedValue({
      directorySaved: true,
      notified: true,
      ok: true,
    });

    const res = await call(VALID);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      result: { directorySaved: true, notified: true, ok: true },
    });
    expect(approval.changeStepApprover).toHaveBeenCalledWith(VALID);
  });

  it("returns 500 when the change throws", async () => {
    approval.changeStepApprover.mockRejectedValue(new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect((await call(VALID)).status).toBe(500);
  });
});
