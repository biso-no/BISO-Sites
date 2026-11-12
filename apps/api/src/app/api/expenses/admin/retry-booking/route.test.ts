import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const posting = vi.hoisted(() => ({ retryExpenseBooking: vi.fn() }));
const auth = vi.hoisted(() => ({ isInternalRequest: vi.fn() }));
const flags = vi.hoisted(() => ({ isFeatureEnabled: vi.fn() }));

vi.mock("@/lib/expense-posting", () => posting);
vi.mock("@/lib/internal-auth", () => auth);
vi.mock("@repo/shared/utils/feature-flags-server", () => flags);

import { POST } from "./route";

const VALID = {
  actor: { email: "admin@biso.no", kind: "admin", name: "Admin" },
  expenseId: "expense-1",
};

const call = (body: unknown) =>
  POST(
    new NextRequest("http://localhost/api/expenses/admin/retry-booking", {
      body: JSON.stringify(body),
      method: "POST",
    })
  );

beforeEach(() => {
  posting.retryExpenseBooking.mockReset();
  auth.isInternalRequest.mockReset().mockReturnValue(true);
  flags.isFeatureEnabled.mockReset().mockResolvedValue(true);
});

describe("POST /api/expenses/admin/retry-booking", () => {
  it("returns 401 without the internal secret", async () => {
    auth.isInternalRequest.mockReturnValue(false);

    expect((await call(VALID)).status).toBe(401);
    expect(posting.retryExpenseBooking).not.toHaveBeenCalled();
  });

  it("returns 400 for a malformed body", async () => {
    for (const body of [
      { ...VALID, expenseId: "" },
      { ...VALID, actor: { ...VALID.actor, kind: "system" } },
    ]) {
      expect((await call(body)).status).toBe(400);
    }
    expect(posting.retryExpenseBooking).not.toHaveBeenCalled();
  });

  it("returns 409 when posting is switched off", async () => {
    flags.isFeatureEnabled.mockResolvedValue(false);

    const res = await call(VALID);

    expect(res.status).toBe(409);
    expect(flags.isFeatureEnabled).toHaveBeenCalledWith(
      "expenses_ledger_posting"
    );
    expect(posting.retryExpenseBooking).not.toHaveBeenCalled();
  });

  it("returns 400 when the retry is refused", async () => {
    posting.retryExpenseBooking.mockResolvedValue({
      code: "not_failed",
      error: "Only failed bookings can be retried.",
      ok: false,
    });

    const res = await call(VALID);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      code: "not_failed",
      error: "Only failed bookings can be retried.",
    });
  });

  it("returns codes for 400 body, 409 flag and 401 is plain", async () => {
    expect((await (await call({ ...VALID, expenseId: "" })).json()).code).toBe(
      "invalid_body"
    );
    flags.isFeatureEnabled.mockResolvedValue(false);
    expect((await (await call(VALID)).json()).code).toBe("posting_disabled");
  });

  it("returns 500 when the retry throws", async () => {
    posting.retryExpenseBooking.mockRejectedValue(new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect((await call(VALID)).status).toBe(500);
  });

  it("returns 200 with the status on success", async () => {
    posting.retryExpenseBooking.mockResolvedValue({
      ok: true,
      status: "success",
    });

    const res = await call(VALID);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      result: { ok: true, status: "success" },
    });
  });
});
