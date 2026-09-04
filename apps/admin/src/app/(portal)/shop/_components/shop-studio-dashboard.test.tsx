import { expect, mock, test } from "bun:test";
import type { Orders } from "@repo/api/types/appwrite";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { OrderStats, ProductStats } from "../../_actions/shop";
import type {
  CatalogTabData,
  OrdersTabData,
  ProductWithTranslations,
} from "./shop-studio-types";

// `next-intl`, `next/link` and `next/navigation` are external framework
// modules, not one of the app's own `@/lib/*` shared modules, so mocking them
// wholesale is fine. `mock.module` is process-wide, so these stubs match the
// ones in the sibling suites export for export.
mock.module("next-intl", () => ({
  useLocale: () => "no",
  useTranslations: (namespace: string) => (key: string) =>
    `${namespace}.${key}`,
}));

mock.module("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) =>
    createElement("a", { href }, children),
}));

mock.module("next/navigation", () => ({
  notFound: () => undefined,
  redirect: () => undefined,
  usePathname: () => "/shop",
  useRouter: () => ({ push: () => undefined }),
  useSearchParams: () => new URLSearchParams(""),
}));

mock.module("../../_actions/shop-export", () => ({
  exportOrdersCsv: () =>
    Promise.resolve({ csv: "", rowCount: 0, truncated: false }),
}));

mock.module("../../_actions/shop", () => ({
  deleteProduct: () => Promise.resolve({ error: null }),
}));

const { ShopStudioDashboard } = await import("./shop-studio-dashboard");

const product = {
  $createdAt: "2026-01-01T00:00:00.000Z",
  $id: "product-1",
  $updatedAt: "2026-01-02T00:00:00.000Z",
  category: "Merch",
  cover_pattern: "dotted",
  image: null,
  inventory_mode: "tracked",
  member_only: false,
  member_price: null,
  regular_price: 249,
  slug: "biso-hoodie",
  status: "published",
  stock: 12,
  tags: ["apparel"],
  translation_refs: [{ locale: "no", title: "BISO Hoodie" }],
} as unknown as ProductWithTranslations;

const order = {
  $createdAt: "2026-02-03T10:00:00.000Z",
  $id: "order-000000001",
  buyer_email: "student@biso.no",
  buyer_name: "Ola Nordmann",
  currency: "NOK",
  discount_total: 0,
  order_items: [],
  status: "paid",
  subtotal: 249,
  total: 249,
} as unknown as Orders;

const productStats: ProductStats = {
  all: 57,
  archived: 3,
  drafts: 9,
  lowStock: 2,
  pending: 4,
  published: 41,
};

const orderStats: OrderStats = {
  all: 1043,
  authorized: 0,
  cancelled: 0,
  capped: false,
  failed: 0,
  paid: 980,
  paidRevenue: 245_000,
  pending: 0,
  refunded: 0,
};

const catalog: CatalogTabData = {
  featuredDraft: null,
  params: { page: 1, q: "", size: 25, status: "all" },
  rows: [product],
  stats: productStats,
  total: 57,
};

const orders: OrdersTabData = {
  params: { page: 1, q: "", size: 25, status: "all" },
  productOptions: [{ id: "product-1", name: "BISO Hoodie" }],
  rows: [order],
  stats: orderStats,
  total: 1043,
  truncated: false,
};

test("the catalog view renders only the catalog tab's table", () => {
  const html = renderToStaticMarkup(
    createElement(ShopStudioDashboard, {
      activeTab: "catalog" as const,
      catalog,
      orders: null,
      showOrders: true,
    })
  );

  expect(html).toContain("BISO Hoodie");
  expect(html).not.toContain("Ola Nordmann");
  // Both tabs are offered…
  expect(html).toContain("adminShop.orders.title");
  // …but the orders tab carries no count, because no order data was fetched.
  // A badge here could only be stale.
  expect(html).not.toContain(">1043<");
});

test("the orders view renders only the orders tab's table", () => {
  const html = renderToStaticMarkup(
    createElement(ShopStudioDashboard, {
      activeTab: "orders" as const,
      catalog: null,
      orders,
      showOrders: true,
    })
  );

  expect(html).toContain("Ola Nordmann");
  // "BISO Hoodie" itself is legitimately present as a product-filter option;
  // what must be absent is the catalog table.
  expect(html).not.toContain("adminShop.products.table.product");
  expect(html).toContain("adminShop.orders.export");
});

test("a viewer without shop operations access is offered no orders tab", () => {
  const html = renderToStaticMarkup(
    createElement(ShopStudioDashboard, {
      activeTab: "catalog" as const,
      catalog,
      orders: null,
      showOrders: false,
    })
  );

  expect(html).toContain("adminPortal.shop.studio.tabs.catalog");
  expect(html).not.toContain("adminShop.orders.title");
});
