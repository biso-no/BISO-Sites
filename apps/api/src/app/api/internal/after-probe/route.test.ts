import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const scheduled = vi.hoisted(() => [] as Array<() => Promise<void>>);

vi.mock("server-only", () => ({}));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (task: () => Promise<void>) => {
    scheduled.push(task);
  },
}));

import { maxDuration, POST } from "./route";

const SECRET = "cron-secret-value";
const request = (headers: Record<string, string> = {}) =>
  new Request("https://api.biso.no/api/internal/after-probe", {
    headers,
    method: "POST",
  });

describe("POST /api/internal/after-probe", () => {
  beforeEach(() => {
    scheduled.length = 0;
    vi.useFakeTimers();
    vi.stubEnv("CRON_SECRET", SECRET);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("allows the longest function duration", () => {
    expect(maxDuration).toBe(300);
  });

  it("requires the cron secret and schedules nothing without it", async () => {
    expect((await POST(request())).status).toBe(401);
    expect((await POST(request({ "x-cron-secret": "wrong" }))).status).toBe(
      401
    );
    vi.stubEnv("CRON_SECRET", "");
    expect((await POST(request({ "x-cron-secret": SECRET }))).status).toBe(500);
    expect(scheduled).toHaveLength(0);
  });

  it("answers at once and logs alive lines every 15 seconds for 180", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    const response = await POST(request({ authorization: `Bearer ${SECRET}` }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ started: true });
    expect(scheduled).toHaveLength(1);
    expect(log).not.toHaveBeenCalled();

    const run = scheduled[0]?.();
    await vi.advanceTimersByTimeAsync(180_000);
    await run;

    const lines = log.mock.calls.map((call) => String(call[0]));
    expect(lines[0]).toContain("[after-probe] start");
    expect(lines.filter((l) => l.startsWith("[after-probe] alive"))).toEqual(
      Array.from(
        { length: 12 },
        (_, i) => `[after-probe] alive ${(i + 1) * 15}`
      )
    );
    expect(lines.at(-1)).toContain("[after-probe] done");
  });
});
