import { describe, expect, it } from "vitest";
import {
  computeAvailableStock,
  sumReservedQuantity,
} from "./stock-availability";

describe("sumReservedQuantity", () => {
  it("sums the quantity across reservation rows", () => {
    expect(
      sumReservedQuantity([{ quantity: 2 }, { quantity: 3 }, { quantity: 1 }])
    ).toBe(6);
  });

  it("treats missing or non-numeric quantities as zero", () => {
    expect(sumReservedQuantity([{ quantity: 2 }, {}, { quantity: null }])).toBe(
      2
    );
  });

  it("returns zero for no reservations", () => {
    expect(sumReservedQuantity([])).toBe(0);
  });
});

describe("computeAvailableStock", () => {
  it("subtracts reserved quantity from tracked stock", () => {
    expect(computeAvailableStock(10, 4)).toBe(6);
  });

  it("never reports negative availability", () => {
    expect(computeAvailableStock(3, 10)).toBe(0);
  });

  it("treats untracked stock (null/undefined) as unlimited", () => {
    expect(computeAvailableStock(null, 5)).toBe(Number.POSITIVE_INFINITY);
    expect(computeAvailableStock(undefined, 5)).toBe(Number.POSITIVE_INFINITY);
  });
});
