import { describe, expect, it } from "vitest";
import {
  deriveConnectToken,
  hashConnectToken,
  newConnectNonce,
} from "./connect-token";

const SECRET = "test-secret";
const BASE64URL = /^[A-Za-z0-9_-]+$/;
const HEX_64 = /^[0-9a-f]{64}$/;
const HEX_32 = /^[0-9a-f]{32}$/;

describe("deriveConnectToken", () => {
  it("same participant and nonce give the same token", () => {
    const first = deriveConnectToken(SECRET, "p1", "nonce-a");
    const second = deriveConnectToken(SECRET, "p1", "nonce-a");
    expect(first).toBe(second);
    expect(first).toMatch(BASE64URL);
  });

  it("different nonce, different token", () => {
    expect(deriveConnectToken(SECRET, "p1", "nonce-a")).not.toBe(
      deriveConnectToken(SECRET, "p1", "nonce-b")
    );
  });

  it("different participant, different token", () => {
    expect(deriveConnectToken(SECRET, "p1", "nonce-a")).not.toBe(
      deriveConnectToken(SECRET, "p2", "nonce-a")
    );
  });

  it("refuses an empty secret", () => {
    expect(() => deriveConnectToken("", "p1", "nonce-a")).toThrow();
  });
});

describe("hashConnectToken", () => {
  it("hash is 64 hex chars", () => {
    const token = deriveConnectToken(SECRET, "p1", "nonce-a");
    expect(hashConnectToken(token)).toMatch(HEX_64);
    expect(hashConnectToken(token)).toBe(hashConnectToken(token));
  });
});

describe("newConnectNonce", () => {
  it("is 16 random bytes as hex", () => {
    const nonce = newConnectNonce();
    expect(nonce).toMatch(HEX_32);
    expect(newConnectNonce()).not.toBe(nonce);
  });
});
