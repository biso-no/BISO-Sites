import { createHash, createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  parseVippsWebhookEvent,
  verifyVippsWebhookSignature,
} from "./webhook";

const SECRET = "090a478d-37ff-4e77-970e-d457aeb26a3a";
const HOST = "api.example.com";
const DATE = "Thu, 30 Mar 2023 08:38:32 GMT";
const PATH = "/api/payment/vipps/callback";
const BODY = JSON.stringify({
  reference: "order-123",
  name: "AUTHORIZED",
  pspReference: "psp-1",
});

function sign(body: string, secret = SECRET, path = PATH) {
  const contentSha = createHash("sha256").update(body, "utf8").digest("base64");
  const signedString = `POST\n${path}\n${DATE};${HOST};${contentSha}`;
  const signature = createHmac("sha256", secret)
    .update(signedString, "utf8")
    .digest("base64");
  return {
    "x-ms-content-sha256": contentSha,
    "x-ms-date": DATE,
    host: HOST,
    authorization: `HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=${signature}`,
  };
}

describe("verifyVippsWebhookSignature", () => {
  it("accepts a correctly signed request", () => {
    expect(
      verifyVippsWebhookSignature({
        headers: sign(BODY),
        pathAndQuery: PATH,
        rawBody: BODY,
        secret: SECRET,
      })
    ).toBe(true);
  });

  it("rejects a tampered body", () => {
    expect(
      verifyVippsWebhookSignature({
        headers: sign(BODY),
        pathAndQuery: PATH,
        rawBody: `${BODY} `,
        secret: SECRET,
      })
    ).toBe(false);
  });

  it("rejects a wrong secret", () => {
    expect(
      verifyVippsWebhookSignature({
        headers: sign(BODY),
        pathAndQuery: PATH,
        rawBody: BODY,
        secret: "not-the-secret",
      })
    ).toBe(false);
  });

  it("rejects a path mismatch", () => {
    expect(
      verifyVippsWebhookSignature({
        headers: sign(BODY, SECRET, "/other"),
        pathAndQuery: PATH,
        rawBody: BODY,
        secret: SECRET,
      })
    ).toBe(false);
  });

  it("rejects missing headers", () => {
    expect(
      verifyVippsWebhookSignature({
        headers: {},
        pathAndQuery: PATH,
        rawBody: BODY,
        secret: SECRET,
      })
    ).toBe(false);
  });
});

describe("parseVippsWebhookEvent", () => {
  it("parses a valid event", () => {
    const event = parseVippsWebhookEvent(BODY);
    expect(event?.reference).toBe("order-123");
    expect(event?.name).toBe("AUTHORIZED");
  });

  it("returns null when reference or name is missing", () => {
    expect(parseVippsWebhookEvent(JSON.stringify({ name: "AUTHORIZED" }))).toBeNull();
    expect(parseVippsWebhookEvent(JSON.stringify({ reference: "x" }))).toBeNull();
  });

  it("returns null on malformed JSON", () => {
    expect(parseVippsWebhookEvent("{not json")).toBeNull();
  });
});
