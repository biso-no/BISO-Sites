import { beforeEach, describe, expect, it, vi } from "vitest";

const enqueueDueReminders = vi.hoisted(() => vi.fn());
const processDeliveries = vi.hoisted(() => vi.fn());
const listRows = vi.hoisted(() => vi.fn());
const isSmtpConfigured = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => ({ db: { listRows } })),
}));
vi.mock("@repo/connectors/email", () => ({
  isSmtpConfigured,
  sendEmail: vi.fn(),
}));
vi.mock("@repo/shared/big-events/delivery-queue", () => ({
  enqueueDueReminders,
  processDeliveries,
}));

import { POST } from "./route";

const SECRET = "cron-secret-value";
const URL_ = "https://api.biso.no/api/cron/big-event-deliveries";
const request = (headers: Record<string, string> = {}) =>
  new Request(URL_, { headers, method: "POST" });

describe("POST /api/cron/big-event-deliveries", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", SECRET);
    vi.stubEnv("BIG_EVENTS_CONNECT_SECRET", "connect-secret");
    vi.stubEnv("NEXT_PUBLIC_WEB_BASE_URL", "https://biso.no");
    vi.stubEnv("BIG_EVENTS_EMAILS_PER_MINUTE", "");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(new Response(null));
    isSmtpConfigured.mockReturnValue(true);
    listRows.mockResolvedValue({ rows: [], total: 0 });
    enqueueDueReminders.mockResolvedValue(undefined);
    processDeliveries.mockResolvedValue({ failed: 0, remaining: 0, sent: 2 });
  });

  it("rejects a wrong secret", async () => {
    expect((await POST(request())).status).toBe(401);
    expect((await POST(request({ "x-cron-secret": "wrong" }))).status).toBe(
      401
    );
  });

  it("reports not_configured without the connect secret", async () => {
    vi.stubEnv("BIG_EVENTS_CONNECT_SECRET", "");
    expect((await POST(request({ "x-cron-secret": SECRET }))).status).toBe(500);
  });

  it("skips when SMTP is not configured", async () => {
    isSmtpConfigured.mockReturnValue(false);
    const response = await POST(request({ "x-cron-secret": SECRET }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ skipped: "smtp_not_configured" });
    expect(processDeliveries).not.toHaveBeenCalled();
  });

  it("processes the queue and does not re-kick when nothing remains", async () => {
    const response = await POST(request({ "x-cron-secret": SECRET }));
    expect(await response.json()).toEqual({
      failed: 0,
      remaining: 0,
      sent: 2,
    });
    expect(enqueueDueReminders).toHaveBeenCalledTimes(1);
    expect(processDeliveries.mock.calls[0]?.[1]).toMatchObject({
      budgetMs: 45_000,
      perMinute: 25,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses a valid per-minute override and ignores an invalid one", async () => {
    vi.stubEnv("BIG_EVENTS_EMAILS_PER_MINUTE", "10");
    await POST(request({ "x-cron-secret": SECRET }));
    expect(processDeliveries.mock.calls[0]?.[1].perMinute).toBe(10);
    vi.stubEnv("BIG_EVENTS_EMAILS_PER_MINUTE", "-3");
    await POST(request({ "x-cron-secret": SECRET }));
    expect(processDeliveries.mock.calls[1]?.[1].perMinute).toBe(25);
  });

  it("processes and re-kicks when work remains", async () => {
    processDeliveries.mockResolvedValue({ failed: 1, remaining: 3, sent: 5 });
    const response = await POST(request({ "x-cron-secret": SECRET }));
    expect(await response.json()).toEqual({
      failed: 1,
      remaining: 3,
      sent: 5,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [target, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(target)).toBe(URL_);
    expect(init).toMatchObject({
      headers: { "x-cron-secret": SECRET },
      method: "POST",
    });
  });

  it("survives a failing re-kick", async () => {
    processDeliveries.mockResolvedValue({ failed: 0, remaining: 1, sent: 1 });
    fetchMock.mockRejectedValue(new Error("network"));
    expect((await POST(request({ "x-cron-secret": SECRET }))).status).toBe(200);
  });

  it("yields to another active chain", async () => {
    listRows.mockResolvedValue({ rows: [{ $id: "d1" }], total: 1 });
    const response = await POST(request({ "x-cron-secret": SECRET }));
    expect(await response.json()).toEqual({ skipped: "busy" });
    expect(processDeliveries).not.toHaveBeenCalled();
    expect(enqueueDueReminders).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    const query = JSON.stringify(listRows.mock.calls[0]?.[2]);
    expect(query).toContain("claimed_at");
    expect(query).toContain("claimed_by");
  });

  it("continues its own chain", async () => {
    const chain = "0b9f2c1e-5a4d-4c3b-9e8f-1a2b3c4d5e6f";
    processDeliveries.mockResolvedValue({ failed: 0, remaining: 2, sent: 1 });
    await POST(request({ "x-cron-secret": SECRET, "x-delivery-chain": chain }));
    expect(JSON.stringify(listRows.mock.calls[0]?.[2])).toContain(chain);
    expect(processDeliveries.mock.calls[0]?.[1].runId).toBe(chain);
    expect(fetchMock.mock.calls[0]?.[1].headers).toMatchObject({
      "x-delivery-chain": chain,
      "x-kick-depth": "1",
    });
  });

  it("ignores a malformed chain header", async () => {
    await POST(
      request({ "x-cron-secret": SECRET, "x-delivery-chain": "not-a-uuid" })
    );
    expect(processDeliveries.mock.calls[0]?.[1].runId).not.toBe("not-a-uuid");
  });

  it("stops re-kicking at depth 50", async () => {
    processDeliveries.mockResolvedValue({ failed: 0, remaining: 4, sent: 1 });
    await POST(request({ "x-cron-secret": SECRET, "x-kick-depth": "50" }));
    expect(processDeliveries).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
    await POST(request({ "x-cron-secret": SECRET, "x-kick-depth": "49" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
