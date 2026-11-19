import { describe, expect, it } from "vitest";
import { MAX_RELAY_BYTES, relayTooLarge } from "./relay";

const withLength = (value?: string) =>
  new Request("https://example.com/api/relay", {
    method: "POST",
    headers: value === undefined ? {} : { "content-length": value },
  });

describe("relayTooLarge", () => {
  it("allows a body exactly at the cap", () => {
    expect(MAX_RELAY_BYTES).toBe(10_485_760);
    expect(relayTooLarge(withLength("10485760"))).toBe(false);
  });

  it("rejects a body one byte over the cap", () => {
    expect(relayTooLarge(withLength("10485761"))).toBe(true);
  });

  it("leaves small, missing and non-numeric lengths to the SDK", () => {
    expect(relayTooLarge(withLength("2048"))).toBe(false);
    expect(relayTooLarge(withLength())).toBe(false);
    expect(relayTooLarge(withLength("abc"))).toBe(false);
  });
});
