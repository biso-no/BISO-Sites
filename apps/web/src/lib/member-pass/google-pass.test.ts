import { createVerify, generateKeyPairSync } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buildGoogleWalletObject,
  googleObjectId,
  signGoogleSaveJwt,
} from "./google-pass";

const HOLDER = {
  expiryDate: "2026-12-31",
  membershipName: "Semester",
  name: "Markus Heien",
  startDate: "2026-07-01",
  term: null,
};

describe("buildGoogleWalletObject", () => {
  const object = buildGoogleWalletObject({
    holder: HOLDER,
    issuerId: "3388",
    labels: { member: "Member", validUntil: "Valid until" },
    logoUrl: "https://biso.no/apple-touch-icon.png",
    termLabel: "Fall 2026",
    totpKeyHex: "ab".repeat(20),
    userId: "user-1",
  });

  it("uses a rotating TOTP barcode with a hex key", () => {
    expect(object.rotatingBarcode).toEqual({
      totpDetails: {
        algorithm: "TOTP_SHA1",
        parameters: [{ key: "ab".repeat(20), valueLength: 6 }],
        periodMillis: "30000",
      },
      type: "QR_CODE",
      valuePattern: "g1.user-1.{totp_value_0}",
    });
  });

  it("identifies and bounds the pass", () => {
    expect(object.id).toBe("3388.member-user-1");
    expect(object.classId).toBe("3388.biso-membership");
    expect(object.state).toBe("ACTIVE");
    expect(object.validTimeInterval).toEqual({
      end: { date: "2026-12-31T23:59:59Z" },
      start: { date: "2026-07-01T00:00:00Z" },
    });
  });

  it("sanitizes ids", () => {
    expect(googleObjectId("1", "a b/c")).toBe("1.member-a_b_c");
  });
});

describe("signGoogleSaveJwt", () => {
  it("produces an RS256 JWT Google can verify", () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });
    const jwt = signGoogleSaveJwt({
      config: {
        clientEmail: "wallet@x.iam.gserviceaccount.com",
        issuerId: "3388",
        privateKey: privateKey
          .export({ format: "pem", type: "pkcs8" })
          .toString(),
      },
      genericObject: { id: "3388.member-user-1" },
      now: new Date("2026-09-17T10:00:00Z"),
      origins: ["https://biso.no"],
    });
    const [header, payload, signature] = jwt.split(".");
    expect(
      JSON.parse(Buffer.from(header ?? "", "base64url").toString())
    ).toEqual({ alg: "RS256", typ: "JWT" });
    const claims = JSON.parse(
      Buffer.from(payload ?? "", "base64url").toString()
    );
    expect(claims).toMatchObject({
      aud: "google",
      iat: 1_789_639_200,
      iss: "wallet@x.iam.gserviceaccount.com",
      origins: ["https://biso.no"],
      typ: "savetowallet",
    });
    expect(claims.payload.genericObjects).toEqual([
      { id: "3388.member-user-1" },
    ]);
    expect(claims.payload.genericClasses).toEqual([
      { id: "3388.biso-membership" },
    ]);
    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${header}.${payload}`);
    expect(
      verifier.verify(publicKey, Buffer.from(signature ?? "", "base64url"))
    ).toBe(true);
  });
});
