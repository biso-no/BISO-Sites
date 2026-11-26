import {
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from "bun:test";

mock.module("server-only", () => ({}));
const { kickDeliveries } = await import("./kick-deliveries");

const realFetch = globalThis.fetch;
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("kickDeliveries", () => {
  let warn: ReturnType<typeof spyOn>;

  beforeEach(() => {
    warn = spyOn(console, "warn").mockImplementation(() => undefined);
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.test";
    process.env.CRON_SECRET = "s3cret";
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    warn.mockRestore();
  });

  test("kick logs a failed status without the url or secret", async () => {
    globalThis.fetch = mock(
      async () => new Response("no", { status: 503 })
    ) as never;
    kickDeliveries();
    await flush();
    expect(warn).toHaveBeenCalledTimes(1);
    const line = String(warn.mock.calls[0]?.[0]);
    expect(line).toContain("503");
    expect(line).not.toContain("api.example.test");
    expect(line).not.toContain("s3cret");
  });

  test("kick stays quiet on success", async () => {
    globalThis.fetch = mock(async () => new Response("ok")) as never;
    kickDeliveries();
    await flush();
    expect(warn).not.toHaveBeenCalled();
  });

  test("kick logs once per process when the env is missing", () => {
    process.env.CRON_SECRET = "";
    const fetchMock = mock(async () => new Response("ok"));
    globalThis.fetch = fetchMock as never;
    kickDeliveries();
    kickDeliveries();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
