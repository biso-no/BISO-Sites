import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test";

const getUserAuthContext = mock();
const callExpensesApi = mock();
mock.module("server-only", () => ({}));
mock.module("@/lib/authorization", () => ({ getUserAuthContext }));
mock.module("@/lib/expenses-api", () => ({ callExpensesApi }));

const { runRerunCheck } = await import("./actions");

const RESULT = {
  checked: 2,
  considered: 3,
  hitRate: 0.5,
  hits: 1,
  misses: [],
  stoppedEarly: false,
};

beforeEach(() => {
  spyOn(console, "error").mockImplementation(() => undefined);
  getUserAuthContext.mockReset();
  callExpensesApi.mockReset();
  getUserAuthContext.mockResolvedValue({ roles: ["globaladmin"] });
  callExpensesApi.mockResolvedValue({ data: { result: RESULT }, ok: true });
});

describe("runRerunCheck", () => {
  test("refuses anyone who is not a global admin", async () => {
    getUserAuthContext.mockResolvedValue({ roles: ["campusadmin"] });

    expect(await runRerunCheck()).toEqual({ error: "forbidden" });
    expect(callExpensesApi).not.toHaveBeenCalled();
  });

  test("returns the result from the api", async () => {
    expect(await runRerunCheck()).toEqual({ data: RESULT });
    expect(callExpensesApi).toHaveBeenCalledWith(
      "/api/expenses/admin/eval-rerun",
      {}
    );
  });

  test("maps ai_disabled and other failures to error codes", async () => {
    callExpensesApi.mockResolvedValueOnce({
      code: "ai_disabled",
      error: "off",
      ok: false,
    });
    expect(await runRerunCheck()).toEqual({ error: "ai_disabled" });

    callExpensesApi.mockResolvedValueOnce({ error: "x", ok: false });
    expect(await runRerunCheck()).toEqual({ error: "api_failed" });
  });
});
