import { describe, expect, it } from "vitest";
import {
  appOrderDeepLink,
  checkoutReturnUrl,
  isCheckoutClient,
} from "./checkout-return";

describe("isCheckoutClient", () => {
  it("accepts the known surfaces", () => {
    expect(isCheckoutClient("web")).toBe(true);
    expect(isCheckoutClient("app")).toBe(true);
  });

  it("rejects anything else, so a URL can never be smuggled through", () => {
    expect(isCheckoutClient("https://evil.example")).toBe(false);
    expect(isCheckoutClient("")).toBe(false);
    expect(isCheckoutClient(undefined)).toBe(false);
    expect(isCheckoutClient(null)).toBe(false);
    expect(isCheckoutClient({ toString: () => "app" })).toBe(false);
  });
});

describe("checkoutReturnUrl", () => {
  it("points at the web return route, which owns reconciliation", () => {
    expect(checkoutReturnUrl("https://biso.no", "order-1")).toBe(
      "https://biso.no/api/checkout/return?orderId=order-1"
    );
  });

  it("leaves the web URL unmarked so existing behaviour is untouched", () => {
    expect(
      checkoutReturnUrl("https://biso.no", "order-1", "web")
    ).not.toContain("client=");
  });

  it("marks an app checkout so the return route can deep-link back", () => {
    expect(checkoutReturnUrl("https://biso.no", "order-1", "app")).toBe(
      "https://biso.no/api/checkout/return?orderId=order-1&client=app"
    );
  });

  it("normalises a trailing slash on the base URL", () => {
    expect(checkoutReturnUrl("https://biso.no/", "order-1")).toBe(
      "https://biso.no/api/checkout/return?orderId=order-1"
    );
  });

  it("escapes the order id", () => {
    expect(checkoutReturnUrl("https://biso.no", "a b&c")).toBe(
      "https://biso.no/api/checkout/return?orderId=a%20b%26c"
    );
  });
});

describe("appOrderDeepLink", () => {
  it("carries the order and its status back into the app", () => {
    expect(appOrderDeepLink("order-1", "paid")).toBe(
      "biso://shop/order?orderId=order-1&status=paid"
    );
  });

  it("omits an unknown status rather than inventing one", () => {
    expect(appOrderDeepLink("order-1", null)).toBe(
      "biso://shop/order?orderId=order-1"
    );
  });

  it("produces a parseable absolute URL, as the redirect helper requires", () => {
    const url = new URL(appOrderDeepLink("order 1", "paid"));
    expect(url.protocol).toBe("biso:");
    expect(url.searchParams.get("orderId")).toBe("order 1");
  });
});
