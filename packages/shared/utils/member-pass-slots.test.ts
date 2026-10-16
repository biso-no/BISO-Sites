import { describe, expect, it } from "vitest";
import {
  codesRemaining,
  passSlot,
  selectCurrentCode,
  slotSecondsLeft,
} from "./member-pass-slots";

const codes = [100, 101, 102].map((slot) => ({ code: `c${slot}`, slot }));

describe("member pass slots", () => {
  it("numbers 30-second slots from the epoch", () => {
    expect(passSlot(0)).toBe(0);
    expect(passSlot(29_999)).toBe(0);
    expect(passSlot(30_000)).toBe(1);
  });

  it("counts the whole seconds left in a slot", () => {
    expect(slotSecondsLeft(30_000)).toBe(30);
    expect(slotSecondsLeft(59_001)).toBe(1);
  });

  it("selects the code for the current slot", () => {
    expect(selectCurrentCode(codes, 101)?.code).toBe("c101");
    expect(selectCurrentCode(codes, 99)).toBeNull();
    expect(selectCurrentCode(codes, 103)).toBeNull();
  });

  it("counts codes still usable from the current slot", () => {
    expect(codesRemaining(codes, 101)).toBe(2);
    expect(codesRemaining(codes, 103)).toBe(0);
  });
});
