import type { WebshopProducts } from "@repo/api/types/appwrite";
import type { ProductCustomField } from "@repo/shared/utils/product-custom-fields";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations:
    (namespace: string) => (key: string, values?: Record<string, unknown>) =>
      `${namespace}.${key}${values ? JSON.stringify(values) : ""}`,
}));

// The purchase hook talks to server actions; the card's own gate is what is
// under test here.
vi.mock("./use-product-actions", () => ({
  useProductActions: () => ({ addedToCart: false, handleAddToCart: vi.fn() }),
}));

const { AddToCartClient } = await import("./add-to-cart-client");
const { ProductOptionsClient } = await import("./product-options-client");
const { ProductCustomFieldsProvider } = await import(
  "./product-custom-fields-context"
);

/** The members-only label inside a disabled button. */
const DISABLED_MEMBERS_ONLY_BUTTON =
  /<button[^>]*disabled=""[^>]*>(?:(?!<\/button>).)*shop\.product\.membersOnly</;

const memberOnlyProduct = {
  $id: "p1",
  member_only: true,
  slug: "julebord",
} as unknown as WebshopProducts;

function buyCard(isMember: boolean, fields: ProductCustomField[] = []): string {
  return renderToStaticMarkup(
    <ProductCustomFieldsProvider fields={fields}>
      <AddToCartClient
        availableStock={5}
        displayPrice={200}
        hasDiscount={false}
        isMember={isMember}
        memberPrice={null}
        product={memberOnlyProduct}
        questions={<ProductOptionsClient />}
        regularPrice={200}
        savings={0}
        stock={10}
        userId={null}
      />
    </ProductCustomFieldsProvider>
  );
}

describe("the product page's buy card", () => {
  it("shows a members-only product to a non-member but will not sell it", () => {
    // Main (#76): `member_only` gates the purchase, not the visibility.
    const html = buyCard(false);
    expect(html).toContain("shop.product.membersOnlyNotice");
    expect(html).toMatch(DISABLED_MEMBERS_ONLY_BUTTON);
    expect(html).not.toContain("shop.product.addToCart");
  });

  it("sells the same product to a member", () => {
    const html = buyCard(true);
    expect(html).not.toContain("membersOnlyNotice");
    expect(html).toContain("shop.product.addToCart");
  });

  it("asks the product's questions between the price and the button", () => {
    const html = buyCard(true, [
      { id: "size", label: "Size", required: true, type: "text" },
    ]);
    const question = html.indexOf(">Size<");
    expect(question).toBeGreaterThan(html.indexOf("shop.product.price"));
    expect(question).toBeLessThan(html.indexOf("shop.product.addToCart"));
    expect(html).toContain('id="product-field-size"');
    expect(html).toContain('for="product-field-size"');
    expect(html).toContain('aria-required="true"');
  });

  it("draws no question block for a product that asks nothing", () => {
    expect(buyCard(true)).not.toContain("optionsTitle");
  });
});
