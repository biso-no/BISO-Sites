import { beforeEach, describe, expect, it, vi } from "vitest";

const cleanupAllExpiredReservations = vi.hoisted(() => vi.fn());

vi.mock("@/app/actions/cart-reservations", () => ({
  cleanupAllExpiredReservations,
}));
vi.mock("@/lib/utils", () => ({ isProd: false }));

import { POST } from "./route";

const request = () =>
  new Request("https://biso.no/api/cron/cleanup-reservations", {
    method: "POST",
  });

describe("cleanup-reservations cron", () => {
  beforeEach(() => {
    cleanupAllExpiredReservations.mockReset();
    vi.stubEnv("CRON_SECRET", "");
  });

  it("reports the number of reservations cleaned up", async () => {
    cleanupAllExpiredReservations.mockResolvedValue(3);

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ deletedCount: 3 });
  });

  it("answers 500 when the cleanup fails instead of reporting zero", async () => {
    cleanupAllExpiredReservations.mockRejectedValue(new Error("appwrite down"));

    const response = await POST(request());

    expect(response.status).toBe(500);
  });
});
