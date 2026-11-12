import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const evalLib = vi.hoisted(() => ({ runRerunCheck: vi.fn() }));
const auth = vi.hoisted(() => ({ isInternalRequest: vi.fn() }));
const flags = vi.hoisted(() => ({ getFeatureFlagStates: vi.fn() }));

vi.mock("@/lib/expense-eval", () => evalLib);
vi.mock("@/lib/internal-auth", () => auth);
vi.mock("@repo/shared/utils/feature-flags-server", () => flags);
vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => ({ db: {} })),
}));

import { POST } from "./route";

const call = (body: unknown = {}) =>
  POST(
    new NextRequest("http://localhost/api/expenses/admin/eval-rerun", {
      body: JSON.stringify(body),
      method: "POST",
    })
  );

beforeEach(() => {
  evalLib.runRerunCheck.mockReset().mockResolvedValue({ checked: 3 });
  auth.isInternalRequest.mockReset().mockReturnValue(true);
  flags.getFeatureFlagStates
    .mockReset()
    .mockResolvedValue({ expenses_module: true, expenses_ocr: true });
});

describe("POST /api/expenses/admin/eval-rerun", () => {
  it("returns 401 without the internal secret", async () => {
    auth.isInternalRequest.mockReturnValue(false);

    expect((await call()).status).toBe(401);
    expect(evalLib.runRerunCheck).not.toHaveBeenCalled();
  });

  it("returns 409 ai_disabled when the AI is off", async () => {
    flags.getFeatureFlagStates.mockResolvedValue({
      expenses_module: true,
      expenses_ocr: false,
    });

    const res = await call();

    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("ai_disabled");
    expect(evalLib.runRerunCheck).not.toHaveBeenCalled();
  });

  it("returns 400 for a bad limit", async () => {
    expect((await call({ limit: 500 })).status).toBe(400);
  });

  it("returns 200 with the result", async () => {
    const res = await call({ limit: 50 });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ result: { checked: 3 } });
    expect(evalLib.runRerunCheck).toHaveBeenCalledWith(expect.anything(), {
      limit: 50,
    });
  });
});
