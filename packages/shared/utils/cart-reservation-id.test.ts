import { describe, expect, it } from "vitest";
import {
  cartReservationRowId,
  isRowAlreadyExists,
} from "./cart-reservation-id";

/** Appwrite's row-id grammar: no separator may lead. */
const APPWRITE_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

describe("cartReservationRowId", () => {
  it("gives the same id to both writers of one buyer's hold", () => {
    expect(cartReservationRowId("user-1", "product-1")).toBe(
      cartReservationRowId("user-1", "product-1")
    );
  });

  it("separates buyers and products", () => {
    const mine = cartReservationRowId("user-1", "product-1");
    expect(cartReservationRowId("user-2", "product-1")).not.toBe(mine);
    expect(cartReservationRowId("user-1", "product-2")).not.toBe(mine);
  });

  it("does not collide when the ids run together", () => {
    // "ab" + "c" and "a" + "bc" must not hash the same, or two buyers could
    // end up fighting over one row.
    expect(cartReservationRowId("ab", "c")).not.toBe(
      cartReservationRowId("a", "bc")
    );
  });

  it("stays inside Appwrite's id rules, which the whole scheme depends on", () => {
    const id = cartReservationRowId(
      "68b1f4a2c9d3e7f10428",
      "68b1f4a2c9d3e7f10429"
    );
    expect(id.length).toBeLessThanOrEqual(36);
    expect(id).toMatch(APPWRITE_ID_RE);
  });
});

describe("isRowAlreadyExists", () => {
  it("recognises the create race being lost", () => {
    expect(isRowAlreadyExists({ code: 409 })).toBe(true);
  });

  it("does not swallow any other failure", () => {
    expect(isRowAlreadyExists({ code: 500 })).toBe(false);
    expect(isRowAlreadyExists(new Error("appwrite is down"))).toBe(false);
    expect(isRowAlreadyExists(null)).toBe(false);
    expect(isRowAlreadyExists("409")).toBe(false);
  });
});
