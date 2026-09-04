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
// wholesale is fine here. Every message resolves to `namespace.key`, so
// assertions can name the key.
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

// The export server action is stubbed rather than run: these are render tests,
// and importing it for real drags `@repo/api/server` into the test process.
// Its own decision table is covered by `orders-export.test.ts`.
mock.module("../../_actions/shop-export", () => ({
  exportOrdersCsv: () =>
    Promise.resolve({ csv: "", rowCount: 0, truncated: false }),
}));

const { CatalogTab } = await import("./catalog-tab");
const { OrdersTab } = await import("./orders-tab");

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

const draftProduct = {
  ...product,
  $id: "product-2",
  slug: "biso-tote",
  status: "draft",
  translation_refs: [{ locale: "no", title: "BISO Tote" }],
} as unknown as ProductWithTranslations;

const order = {
  $createdAt: "2026-02-03T10:00:00.000Z",
  $id: "order-000000001",
  buyer_email: "student@biso.no",
  buyer_name: "Ola Nordmann",
  currency: "NOK",
  discount_total: 0,
  membership_applied: false,
  order_items: [],
  payment_receipt_url: null,
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
  authorized: 5,
  cancelled: 2,
  capped: false,
  failed: 7,
  paid: 980,
  paidRevenue: 245_000,
  pending: 49,
  refunded: 0,
};

const noop = () => {
  // Intentionally empty: these smoke tests never exercise the callbacks.
};

const catalogData: CatalogTabData = {
  featuredDraft: draftProduct,
  params: { page: 1, q: "", size: 25, status: "all" },
  rows: [product, draftProduct],
  stats: productStats,
  total: 57,
};

const catalogProps = {
  data: catalogData,
  onCancelDelete: noop,
  onCatalogFilterChange: noop,
  onDelete: noop,
  onRequestDelete: noop,
  onSearchChange: noop,
  pendingDeleteId: null,
  searchQuery: "",
};

const ordersData: OrdersTabData = {
  params: { page: 1, q: "", size: 25, status: "all" },
  productOptions: [{ id: "product-1", name: "BISO Hoodie" }],
  rows: [order],
  stats: orderStats,
  total: 1043,
  truncated: false,
};

const ordersProps = {
  data: ordersData,
  onClearFilters: noop,
  onDateFromChange: noop,
  onDateToChange: noop,
  onOrderFilterChange: noop,
  onProductFilterChange: noop,
  onSearchChange: noop,
  searchQuery: "",
};

// ---------------------------------------------------------------------------
// Catalog tab
// ---------------------------------------------------------------------------

test("the catalog tab renders the KPI strip, the featured draft and the server page", () => {
  const html = renderToStaticMarkup(createElement(CatalogTab, catalogProps));

  expect(html).toContain("adminPortal.shop.studio.kpi.liveProducts");
  expect(html).toContain("adminPortal.shop.studio.featured.eyebrow");
  expect(html).toContain("BISO Tote");
  expect(html).toContain("adminShop.products.table.product");
  expect(html).toContain("BISO Hoodie");
});

test("the catalog KPI tiles and chips come from the server stats, not the visible page", () => {
  // Two rows are rendered but the catalog holds 57 products across 41
  // published / 9 drafts / 4 pending / 3 archived. Deriving the counts from
  // `rows` would report one page's worth and change as the user paged.
  const html = renderToStaticMarkup(createElement(CatalogTab, catalogProps));

  expect(html).toContain(">41<");
  expect(html).toContain(">57<");
  expect(html).toContain(">9<");
  expect(html).toContain(">3<");
  expect(html).toContain(">2<");
});

test("the catalog tab renders a pagination bar for the true total", () => {
  const html = renderToStaticMarkup(createElement(CatalogTab, catalogProps));

  expect(html).toContain("adminPortal.common.pagination.summary");
  expect(html).toContain("adminPortal.common.pagination.perPage");
});

test("the catalog tab renders the server's page verbatim, without re-filtering", () => {
  // The status filter is applied by the server action now; a tab that filtered
  // again would blank a page that the server already narrowed.
  const html = renderToStaticMarkup(
    createElement(CatalogTab, {
      ...catalogProps,
      data: {
        ...catalogData,
        params: { ...catalogData.params, status: "archived" },
      },
    })
  );

  expect(html).toContain("BISO Hoodie");
});

test("the catalog tab renders its empty state when the server page is empty", () => {
  const html = renderToStaticMarkup(
    createElement(CatalogTab, {
      ...catalogProps,
      data: { ...catalogData, rows: [], stats: productStats, total: 0 },
    })
  );

  expect(html).toContain("adminShop.messages.noProducts");
  expect(html).not.toContain("BISO Hoodie");
});

// ---------------------------------------------------------------------------
// Orders tab
// ---------------------------------------------------------------------------

test("the orders tab renders the filter bar, the export button and the server page", () => {
  const html = renderToStaticMarkup(createElement(OrdersTab, ordersProps));

  expect(html).toContain("adminShop.orders.status.paid");
  expect(html).toContain("adminPortal.shop.studio.filters.allProducts");
  expect(html).toContain("adminShop.orders.export");
  expect(html).toContain("Ola Nordmann");
  expect(html).toContain("student@biso.no");
});

test("the orders KPI tiles and chips come from the server stats", () => {
  const html = renderToStaticMarkup(createElement(OrdersTab, ordersProps));

  expect(html).toContain("adminPortal.shop.studio.kpi.totalOrders");
  expect(html).toContain("adminPortal.shop.studio.kpi.revenue");
  expect(html).toContain(">1043<");
  expect(html).toContain(">980<");
  expect(html).toContain(">49<");
});

test("the product dropdown offers catalog product ids, not item names", () => {
  // `listOrders` filters on the catalog product's id, so an option valued by
  // the line-item name would silently match nothing.
  const html = renderToStaticMarkup(createElement(OrdersTab, ordersProps));

  expect(html).toContain('value="product-1"');
  expect(html).toContain("BISO Hoodie");
});

test("a capped order count renders as 5000+ and caveats the revenue", () => {
  const html = renderToStaticMarkup(
    createElement(OrdersTab, {
      ...ordersProps,
      data: {
        ...ordersData,
        stats: { ...orderStats, all: 5000, capped: true },
        total: 5000,
      },
    })
  );

  expect(html).toContain("5000+");
  expect(html).not.toContain(">5000<");
  expect(html).toContain("adminPortal.shop.studio.notice.cappedRevenue");
  expect(html).toContain("adminPortal.shop.studio.notice.cappedTotal");
});

test("an uncapped order count renders the exact figure and no caveat", () => {
  const html = renderToStaticMarkup(createElement(OrdersTab, ordersProps));

  expect(html).not.toContain("1043+");
  expect(html).not.toContain("adminPortal.shop.studio.notice.cappedRevenue");
  expect(html).not.toContain("adminPortal.shop.studio.notice.cappedTotal");
});

test("a product-filtered list that hit the 500-order ceiling shows a banner", () => {
  const html = renderToStaticMarkup(
    createElement(OrdersTab, {
      ...ordersProps,
      data: {
        ...ordersData,
        params: { ...ordersData.params, productId: "product-1" },
        truncated: true,
      },
    })
  );

  expect(html).toContain("adminPortal.shop.studio.notice.truncatedOrders");
});

test("an untruncated list shows no ceiling banner", () => {
  const html = renderToStaticMarkup(createElement(OrdersTab, ordersProps));

  expect(html).not.toContain("adminPortal.shop.studio.notice.truncatedOrders");
});

test("the orders tab renders a pagination bar keyed to its own page param", () => {
  const html = renderToStaticMarkup(createElement(OrdersTab, ordersProps));

  expect(html).toContain("adminPortal.common.pagination.summary");
});

test("the orders tab renders the server's page verbatim, without re-filtering", () => {
  const html = renderToStaticMarkup(
    createElement(OrdersTab, {
      ...ordersProps,
      data: {
        ...ordersData,
        params: { ...ordersData.params, status: "refunded" },
      },
    })
  );

  expect(html).toContain("Ola Nordmann");
});

test("the orders tab renders its empty state when the server page is empty", () => {
  const html = renderToStaticMarkup(
    createElement(OrdersTab, {
      ...ordersProps,
      data: { ...ordersData, rows: [], total: 0 },
    })
  );

  expect(html).toContain("adminShop.messages.noOrders");
  expect(html).not.toContain("Ola Nordmann");
});

// The hero describes the whole catalog, so it must not depend on whether a
// draft happens to appear in the rows this page returned.
test("the catalog tab renders the featured draft even when no row on this page is one", () => {
  const html = renderToStaticMarkup(
    createElement(CatalogTab, {
      ...catalogProps,
      data: { ...catalogData, rows: [product] },
    })
  );

  expect(html).toContain("adminPortal.shop.studio.featured.eyebrow");
});

test("the catalog tab omits the featured draft when the catalog has none", () => {
  const html = renderToStaticMarkup(
    createElement(CatalogTab, {
      ...catalogProps,
      data: { ...catalogData, featuredDraft: null },
    })
  );

  expect(html).not.toContain("adminPortal.shop.studio.featured.eyebrow");
});
