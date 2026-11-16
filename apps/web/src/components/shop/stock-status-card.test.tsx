import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations:
    (namespace: string) => (key: string, values?: Record<string, unknown>) =>
      `${namespace}.${key}${values ? JSON.stringify(values) : ""}`,
}));

const { StockStatusCard } = await import("./stock-status-card");

/** The icon's SVG path is full of digits, so read only what the buyer sees. */
const TAG = /<[^>]+>/g;

function stockLine(availableStock: number | null): string {
  return renderToStaticMarkup(
    <StockStatusCard availableStock={availableStock} isLoading={false} />
  ).replace(TAG, "");
}

describe("the buy card's stock line", () => {
  it.each([
    1, 3, 10, 250,
  ])("says in stock, and not how many, with %i left", (count) => {
    const text = stockLine(count);
    expect(text).toBe("shop.card.inStock");
    expect(text).not.toContain(String(count));
  });

  it("says out of stock when nothing is left to buy", () => {
    expect(stockLine(0)).toBe("shop.card.outOfStock");
  });
});
