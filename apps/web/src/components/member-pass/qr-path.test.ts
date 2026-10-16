import { describe, expect, it } from "vitest";
import { qrPath } from "./qr-path";

describe("qrPath", () => {
  it("draws one unit square per dark module", () => {
    const { path, size } = qrPath("v1.user-1.59000000.abcdefghijklmnopqrstuv");
    expect(size).toBeGreaterThanOrEqual(21);
    expect(path.startsWith("M")).toBe(true);
    const squares = path.match(/M/g)?.length ?? 0;
    expect(squares).toBeGreaterThan(size);
    expect(squares).toBeLessThan(size * size);
  });

  it("is deterministic", () => {
    expect(qrPath("abc")).toEqual(qrPath("abc"));
  });
});
