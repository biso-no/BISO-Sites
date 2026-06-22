import Stripe from "stripe";
import { describe, expect, it } from "vitest";
import type { StripeCredentials } from "../credentials/types";
import { buildStripeLineItems, verifyStripeWebhook } from "./index";

const creds: StripeCredentials = {
  secretKey: "sk_test_dummy",
  webhookSecret: "whsec_test_secret",
  testMode: true,
};

describe("buildStripeLineItems", () => {
  it("converts prices to øre, rounds, and lowercases the currency", () => {
    const items = [{ productId: "p1", name: "Tee", price: 199.5, quantity: 2 }];
    const lineItems = buildStripeLineItems(items, "NOK");
    expect(lineItems[0]?.price_data?.unit_amount).toBe(19_950);
    expect(lineItems[0]?.price_data?.currency).toBe("nok");
    expect(lineItems[0]?.quantity).toBe(2);
  });

  it("prefers unit_price and title over price and name", () => {
    const lineItems = buildStripeLineItems(
      [
        {
          productId: "p",
          name: "fallback-name",
          title: "Display Title",
          price: 100,
          unit_price: 49.99,
          quantity: 1,
        },
      ],
      "NOK"
    );
    expect(lineItems[0]?.price_data?.unit_amount).toBe(4999);
    expect(lineItems[0]?.price_data?.product_data?.name).toBe("Display Title");
  });
});

describe("verifyStripeWebhook", () => {
  const stripe = new Stripe(creds.secretKey);

  it("returns the parsed event for a valid signature", () => {
    const payload = JSON.stringify({
      id: "evt_1",
      type: "checkout.session.completed",
      data: { object: { id: "cs_1" } },
    });
    const header = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: creds.webhookSecret,
    });
    const event = verifyStripeWebhook(payload, header, creds);
    expect(event.type).toBe("checkout.session.completed");
  });

  it("throws on a tampered signature", () => {
    const payload = JSON.stringify({ id: "evt_1", type: "x" });
    expect(() => verifyStripeWebhook(payload, "t=1,v1=bad", creds)).toThrow();
  });
});
