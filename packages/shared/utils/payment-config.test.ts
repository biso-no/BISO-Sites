import { describe, expect, it } from "vitest";
import {
  paymentProviderConfigStatus,
  paymentSecretKeys,
  requiredSecretKeys,
} from "./payment-config";

describe("paymentProviderConfigStatus", () => {
  it("is complete when all active-mode Vipps secrets are present", () => {
    const presence = {
      vipps_test_client_id: true,
      vipps_test_client_secret: true,
      vipps_test_subscription_key: true,
      vipps_test_msn: true,
    };
    expect(paymentProviderConfigStatus("vipps", true, presence)).toEqual({
      complete: true,
      missing: [],
    });
  });

  it("reports missing live secrets", () => {
    const result = paymentProviderConfigStatus("vipps", false, {
      vipps_live_client_id: true,
    });
    expect(result.complete).toBe(false);
    expect(result.missing).toContain("vipps_live_msn");
  });

  it("flags a missing Stripe webhook secret", () => {
    expect(
      paymentProviderConfigStatus("stripe", true, {
        stripe_test_secret_key: true,
      })
    ).toEqual({ complete: false, missing: ["stripe_test_webhook_secret"] });
  });

  it("ignores other-mode presence when checking the active mode", () => {
    const result = paymentProviderConfigStatus("stripe", true, {
      stripe_live_secret_key: true,
      stripe_live_webhook_secret: true,
    });
    expect(result.complete).toBe(false);
  });
});

describe("secret key listings", () => {
  it("lists all secret keys for a provider", () => {
    expect(paymentSecretKeys("stripe")).toHaveLength(4);
    expect(paymentSecretKeys("vipps")).toHaveLength(8);
  });

  it("returns the active-mode required keys", () => {
    expect(requiredSecretKeys("stripe", true)).toEqual([
      "stripe_test_secret_key",
      "stripe_test_webhook_secret",
    ]);
  });
});
