import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));

const { callExpensesApi } = await import("./expenses-api");

const realFetch = globalThis.fetch;
const fetchMock = mock();

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.test//";
  process.env.CRON_SECRET = "secret";
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("callExpensesApi", () => {
  test("posts the body with the bearer secret and returns the data", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ result: { ok: true } }, { status: 200 })
    );

    const result = await callExpensesApi("/api/expenses/admin/decide", {
      a: 1,
    });

    expect(result).toEqual({ data: { result: { ok: true } }, ok: true });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.test/api/expenses/admin/decide");
    expect(init.method).toBe("POST");
    expect(init.cache).toBe("no-store");
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
    expect((init.headers as Record<string, string>).authorization).toBe(
      "Bearer secret"
    );
  });

  test("callExpensesApi maps an error body", async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        { code: "not_failed", error: "Only failed bookings can be retried." },
        { status: 400 }
      )
    );

    expect(await callExpensesApi("/x", {})).toEqual({
      code: "not_failed",
      error: "Only failed bookings can be retried.",
      ok: false,
    });
  });

  test("falls back to the status text when the body is not JSON", async () => {
    fetchMock.mockResolvedValue(
      new Response("<html>", { status: 502, statusText: "Bad Gateway" })
    );

    expect(await callExpensesApi("/x", {})).toEqual({
      error: "Bad Gateway",
      ok: false,
    });
  });

  test("reports a network failure instead of throwing", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));

    expect(await callExpensesApi("/x", {})).toEqual({
      error: "offline",
      ok: false,
    });
  });

  test("reports missing configuration without calling the api", async () => {
    process.env.CRON_SECRET = "";

    const result = await callExpensesApi("/x", {});

    expect(result.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
