import { describe, expect, it } from "vitest";
import {
  appCartDeepLink,
  appOrderDeepLink,
  appShopDeepLink,
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

describe("cancel marking", () => {
  it("marks an app cancel URL apart from its success URL", () => {
    const success = checkoutReturnUrl("https://biso.no", "order-1", "app");
    const cancel = checkoutReturnUrl("https://biso.no", "order-1", "app", {
      cancelled: true,
    });

    // Stripe only accepts http(s) here, so both must be the return route —
    // the marker is the only thing that tells a cancelled session (which
    // reconciles to `pending`) apart from a successful one.
    expect(cancel).not.toBe(success);
    expect(cancel).toBe(`${success}&cancelled=1`);
  });

  it("never marks the web URL, which has its own cancel destination", () => {
    expect(
      checkoutReturnUrl("https://biso.no", "order-1", "web", {
        cancelled: true,
      })
    ).not.toContain("cancelled");
  });
});

describe("app fallbacks", () => {
  it("sends a cancelled buyer to the cart, as the website does", () => {
    expect(appCartDeepLink(true)).toBe("biso://shop/cart?cancelled=1");
    expect(appCartDeepLink()).toBe("biso://shop/cart");
  });

  it("falls back to the shop when there is no order to show", () => {
    expect(appShopDeepLink()).toBe("biso://shop");
  });

  it("produces parseable absolute URLs, as the redirect helper requires", () => {
    for (const link of [appCartDeepLink(true), appShopDeepLink()]) {
      expect(new URL(link).protocol).toBe("biso:");
    }
  });
});
