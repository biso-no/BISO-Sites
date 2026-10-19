import { describe, expect, it } from "vitest";
import { sessionIdFromJwt } from "./jwt-session";

function jwtWith(payload: unknown): string {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(payload)}.signature`;
}

describe("sessionIdFromJwt", () => {
  it("returns the sessionId claim", () => {
    expect(
      sessionIdFromJwt(jwtWith({ sessionId: "session-1", userId: "user-1" }))
    ).toBe("session-1");
  });

  it("returns null for a malformed token", () => {
    expect(sessionIdFromJwt("not-a-jwt")).toBeNull();
    expect(sessionIdFromJwt("a.%%%.c")).toBeNull();
  });

  it("returns null when the claim is missing", () => {
    expect(sessionIdFromJwt(jwtWith({ userId: "user-1" }))).toBeNull();
  });
});
