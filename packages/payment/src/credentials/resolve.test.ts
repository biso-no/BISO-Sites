import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearPaymentCredentialCache,
  resolveStripeCredentials,
  resolveVippsCredentials,
} from "./resolve";

const ENV = {
  STRIPE_SECRET_KEY: "sk_env",
  STRIPE_WEBHOOK_SECRET: "whsec_env",
  VIPPS_CLIENT_ID: "env-client",
  VIPPS_CLIENT_SECRET: "env-secret",
  VIPPS_MERCHANT_SERIAL_NUMBER: "env-msn",
  VIPPS_SUBSCRIPTION_KEY: "env-sub",
  VIPPS_WEBHOOK_SECRET: "env-webhook",
};

const DB_ROW = {
  $id: "vipps",
  test_mode: true,
  vipps_test_client_id: "db-client",
  vipps_test_client_secret: "db-secret",
  vipps_test_msn: "db-msn",
  vipps_test_subscription_key: "db-sub",
  vipps_test_webhook_secret: "db-webhook",
};

function appwriteError(code: number, message = `error ${code}`) {
  return Object.assign(new Error(message), { code });
}

describe("payment credential resolution", () => {
  const getRow = vi.fn();
  const db = { getRow } as never;

  beforeEach(() => {
    clearPaymentCredentialCache();
    getRow.mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("falls back to env when the settings row does not exist (404)", async () => {
    getRow.mockRejectedValue(appwriteError(404));

    const creds = await resolveVippsCredentials(db, ENV);

    expect(creds?.clientId).toBe("env-client");
  });

  it("throws on a non-404 read failure instead of falling back to env", async () => {
    getRow.mockRejectedValue(appwriteError(503, "Service unavailable"));

    await expect(resolveVippsCredentials(db, ENV)).rejects.toThrow(
      "Service unavailable"
    );
  });

  it("throws on a network failure that carries no status", async () => {
    getRow.mockRejectedValue(new Error("fetch failed"));

    await expect(resolveStripeCredentials(db, ENV)).rejects.toThrow(
      "fetch failed"
    );
  });

  it("does not cache a failed read, so the next call reads the row again", async () => {
    getRow
      .mockRejectedValueOnce(appwriteError(500))
      .mockResolvedValueOnce(DB_ROW);

    await expect(resolveVippsCredentials(db, ENV)).rejects.toThrow();
    const creds = await resolveVippsCredentials(db, ENV);

    expect(creds?.clientId).toBe("db-client");
    expect(creds?.webhookSecret).toBe("db-webhook");
    expect(getRow).toHaveBeenCalledTimes(2);
  });

  it("caches a 404 so env fallback does not re-read on every call", async () => {
    getRow.mockRejectedValue(appwriteError(404));

    await resolveVippsCredentials(db, ENV);
    await resolveVippsCredentials(db, ENV);

    expect(getRow).toHaveBeenCalledTimes(1);
  });
});
