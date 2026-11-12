import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isInternalRequest } from "./internal-auth";

const request = (headers: Record<string, string>) =>
  new Request("http://localhost/x", { headers });

describe("isInternalRequest", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "s3cret");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts a Bearer secret", () => {
    expect(isInternalRequest(request({ authorization: "Bearer s3cret" }))).toBe(
      true
    );
  });

  it("accepts the x-cron-secret header", () => {
    expect(isInternalRequest(request({ "x-cron-secret": "s3cret" }))).toBe(
      true
    );
  });

  it("rejects a wrong or missing secret", () => {
    expect(isInternalRequest(request({ authorization: "Bearer nope" }))).toBe(
      false
    );
    expect(isInternalRequest(request({}))).toBe(false);
  });

  it("rejects everything when CRON_SECRET is unset", () => {
    vi.stubEnv("CRON_SECRET", "");
    expect(isInternalRequest(request({ authorization: "Bearer " }))).toBe(
      false
    );
    expect(isInternalRequest(request({ "x-cron-secret": "" }))).toBe(false);
  });
});
