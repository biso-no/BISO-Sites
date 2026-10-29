import { describe, expect, test } from "bun:test";
import { isTurnoverTarget } from "./turnover-target";

describe("isTurnoverTarget", () => {
  test.each([
    "leder.oslo@biso.no",
    "markus@biso.no",
    "ola.nordmann@BISO.no",
    "  manager@biso.no ",
  ])("accepts %p", (upn) => {
    expect(isTurnoverTarget(upn)).toBe(true);
  });

  test.each([
    "x@gmail.com",
    "x@biso.no.evil.com",
    "x@sub.biso.no",
    "x@notbiso.no",
    "@biso.no",
    "",
  ])("rejects %p", (upn) => {
    expect(isTurnoverTarget(upn)).toBe(false);
  });
});
