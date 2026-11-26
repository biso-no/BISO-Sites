import { beforeEach, describe, expect, it, vi } from "vitest";

const runDueMessages = vi.hoisted(() => vi.fn());
const isFeatureEnabled = vi.hoisted(() => vi.fn());
const admin = vi.hoisted(() => ({ db: {}, messaging: {}, users: {} }));

vi.mock("server-only", () => ({}));
vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => admin),
}));
vi.mock("@repo/shared/big-events/messages/auto", () => ({ runDueMessages }));
vi.mock("@repo/shared/utils/feature-flags-server", () => ({
  isFeatureEnabled,
}));

import { POST } from "./route";

const SECRET = "cron-secret-value";
const request = (headers: Record<string, string> = {}) =>
  new Request("https://api.biso.no/api/cron/big-event-messages", {
    headers,
    method: "POST",
  });

describe("POST /api/cron/big-event-messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", SECRET);
    vi.stubEnv("NEXT_PUBLIC_WEB_BASE_URL", "https://biso.no/");
    runDueMessages.mockResolvedValue({
      busMessages: 2,
      reminders: 1,
      scheduled: 3,
    });
    isFeatureEnabled.mockResolvedValue(false);
  });

  it("rejects a wrong secret", async () => {
    expect((await POST(request())).status).toBe(401);
    expect((await POST(request({ "x-cron-secret": "wrong" }))).status).toBe(
      401
    );
    expect(runDueMessages).not.toHaveBeenCalled();
  });

  it("reports not_configured without the secret or a web address", async () => {
    vi.stubEnv("NEXT_PUBLIC_WEB_BASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "");
    expect((await POST(request({ "x-cron-secret": SECRET }))).status).toBe(500);
    vi.stubEnv("NEXT_PUBLIC_WEB_BASE_URL", "https://biso.no");
    vi.stubEnv("CRON_SECRET", "");
    expect((await POST(request({ "x-cron-secret": SECRET }))).status).toBe(500);
    expect(runDueMessages).not.toHaveBeenCalled();
  });

  it("runs the due messages and returns the counts", async () => {
    const response = await POST(request({ authorization: `Bearer ${SECRET}` }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      busMessages: 2,
      reminders: 1,
      scheduled: 3,
    });
    const [deps, now] = runDueMessages.mock.calls[0] ?? [];
    expect(deps).toMatchObject({
      db: admin.db,
      messaging: admin.messaging,
      users: admin.users,
      webBase: "https://biso.no",
    });
    expect(now).toBeInstanceOf(Date);
    // SMS follows the big_events_sms switch.
    await deps.isSmsEnabled();
    expect(isFeatureEnabled).toHaveBeenCalledWith("big_events_sms");
  });

  it("answers 500 when the run fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {
      // Expected: the failure is logged.
    });
    runDueMessages.mockRejectedValue(new Error("Appwrite is down"));
    const response = await POST(request({ "x-cron-secret": SECRET }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "failed" });
  });
});
