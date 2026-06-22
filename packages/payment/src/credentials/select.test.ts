import { describe, expect, it } from "vitest";
import { selectStripeCredentials, selectVippsCredentials } from "./select";
import type { PaymentSettingsRow } from "./types";

const fullVippsRow: PaymentSettingsRow = {
  $id: "vipps",
  test_mode: true,
  vipps_test_client_id: "tid",
  vipps_test_client_secret: "tsec",
  vipps_test_subscription_key: "tsub",
  vipps_test_msn: "tmsn",
  vipps_live_client_id: "lid",
  vipps_live_client_secret: "lsec",
  vipps_live_subscription_key: "lsub",
  vipps_live_msn: "lmsn",
};

describe("selectVippsCredentials", () => {
  it("uses the DB test set when test_mode is true", () => {
    const creds = selectVippsCredentials(fullVippsRow, {
      VIPPS_CALLBACK_TOKEN: "cb",
    });
    expect(creds).toMatchObject({
      clientId: "tid",
      clientSecret: "tsec",
      subscriptionKey: "tsub",
      merchantSerialNumber: "tmsn",
      callbackToken: "cb",
      testMode: true,
    });
  });

  it("uses the DB live set when test_mode is false", () => {
    const creds = selectVippsCredentials(
      { ...fullVippsRow, test_mode: false },
      {}
    );
    expect(creds).toMatchObject({
      clientId: "lid",
      merchantSerialNumber: "lmsn",
      testMode: false,
    });
  });

  it("defaults to test mode when test_mode is null", () => {
    const creds = selectVippsCredentials(
      { ...fullVippsRow, test_mode: null },
      {}
    );
    expect(creds?.testMode).toBe(true);
    expect(creds?.clientId).toBe("tid");
  });

  it("falls back to env when the DB active set is incomplete", () => {
    const row = { ...fullVippsRow, vipps_test_client_secret: null };
    const creds = selectVippsCredentials(row, {
      VIPPS_CLIENT_ID: "eid",
      VIPPS_CLIENT_SECRET: "esec",
      VIPPS_SUBSCRIPTION_KEY: "esub",
      VIPPS_MERCHANT_SERIAL_NUMBER: "emsn",
      VIPPS_TEST_MODE: "true",
      VIPPS_CALLBACK_TOKEN: "ecb",
    });
    expect(creds).toMatchObject({
      clientId: "eid",
      merchantSerialNumber: "emsn",
      callbackToken: "ecb",
      testMode: true,
    });
  });

  it("returns null when neither DB nor env is complete", () => {
    expect(selectVippsCredentials(null, {})).toBeNull();
  });
});

describe("selectStripeCredentials", () => {
  it("uses the DB test secret + webhook when test_mode is true", () => {
    const row: PaymentSettingsRow = {
      $id: "stripe",
      test_mode: true,
      stripe_test_secret_key: "sk_test_x",
      stripe_test_webhook_secret: "whsec_t",
      stripe_live_secret_key: "sk_live_x",
      stripe_live_webhook_secret: "whsec_l",
    };
    expect(selectStripeCredentials(row, {})).toEqual({
      secretKey: "sk_test_x",
      webhookSecret: "whsec_t",
      testMode: true,
    });
  });

  it("returns creds with an empty webhook when only the key is set", () => {
    const row: PaymentSettingsRow = {
      $id: "stripe",
      test_mode: true,
      stripe_test_secret_key: "sk_test_x",
    };
    expect(selectStripeCredentials(row, {})).toEqual({
      secretKey: "sk_test_x",
      webhookSecret: "",
      testMode: true,
    });
  });

  it("infers live mode from the env key prefix", () => {
    expect(
      selectStripeCredentials(null, {
        STRIPE_SECRET_KEY: "sk_live_x",
        STRIPE_WEBHOOK_SECRET: "whsec_e",
      })
    ).toEqual({
      secretKey: "sk_live_x",
      webhookSecret: "whsec_e",
      testMode: false,
    });
  });

  it("returns null when no secret key is available anywhere", () => {
    expect(selectStripeCredentials(null, {})).toBeNull();
  });
});
