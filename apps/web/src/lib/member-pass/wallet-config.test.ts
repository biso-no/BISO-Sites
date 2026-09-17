import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { readAppleWalletConfig, readGoogleWalletConfig } from "./wallet-config";

const b64 = (value: string) => Buffer.from(value).toString("base64");

describe("readAppleWalletConfig", () => {
  const env = {
    APPLE_PASS_CERT: b64("CERT"),
    APPLE_PASS_KEY: b64("KEY"),
    APPLE_PASS_KEY_PASSPHRASE: "pw",
    APPLE_PASS_TYPE_ID: "pass.no.biso.member",
    APPLE_TEAM_ID: "4JQ6VWVRGY",
    APPLE_WWDR_CERT: b64("WWDR"),
  };

  it("decodes the PEM values", () => {
    expect(readAppleWalletConfig(env)).toEqual({
      passTypeId: "pass.no.biso.member",
      signerCert: "CERT",
      signerKey: "KEY",
      signerKeyPassphrase: "pw",
      teamId: "4JQ6VWVRGY",
      wwdr: "WWDR",
    });
  });

  it("is null when any required value is missing", () => {
    expect(readAppleWalletConfig({ ...env, APPLE_WWDR_CERT: "" })).toBeNull();
  });
});

describe("readGoogleWalletConfig", () => {
  it("reads the service account JSON", () => {
    const account = b64(
      JSON.stringify({ client_email: "wallet@x.iam", private_key: "PK" })
    );
    expect(
      readGoogleWalletConfig({
        GOOGLE_WALLET_ISSUER_ID: "338800000000",
        GOOGLE_WALLET_SERVICE_ACCOUNT: account,
      })
    ).toEqual({
      clientEmail: "wallet@x.iam",
      issuerId: "338800000000",
      privateKey: "PK",
    });
  });

  it("is null for missing or unreadable values", () => {
    expect(readGoogleWalletConfig({ GOOGLE_WALLET_ISSUER_ID: "1" })).toBeNull();
    expect(
      readGoogleWalletConfig({
        GOOGLE_WALLET_ISSUER_ID: "1",
        GOOGLE_WALLET_SERVICE_ACCOUNT: b64("not json"),
      })
    ).toBeNull();
  });
});
