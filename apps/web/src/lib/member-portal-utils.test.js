import { describe, expect, it } from "vitest";
import {
  getInitialShopCategory,
  getMembershipShopHref,
  shouldShowEstimatedSavings,
} from "./member-portal-utils";

describe("member portal production guards", () => {
  it("falls back to All for unknown shop categories", () => {
    expect(getInitialShopCategory(undefined)).toBe("All");
    expect(getInitialShopCategory("Unknown")).toBe("All");
  });

  it("accepts known shop categories", () => {
    expect(getInitialShopCategory("Membership")).toBe("Membership");
  });

  it("builds membership shop links", () => {
    expect(getMembershipShopHref()).toBe("/shop?category=Membership");
    expect(getMembershipShopHref("year")).toBe(
      "/shop?category=Membership&plan=year"
    );
  });

  it("only shows estimated savings for positive values", () => {
    expect(shouldShowEstimatedSavings(null)).toBe(false);
    expect(shouldShowEstimatedSavings(0)).toBe(false);
    expect(shouldShowEstimatedSavings(-1)).toBe(false);
    expect(shouldShowEstimatedSavings(250)).toBe(true);
  });
});
