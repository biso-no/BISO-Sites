import { Query } from "@repo/api";
import { OrdersStatus } from "@repo/api/types/appwrite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type CheckoutSessionParams, Currency } from "../types/vipps";
import {
  applyOrderStatusTransition,
  createOrder,
  updateOrderWithSession,
} from "./vipps-order-ops";

const db = {
  createRow: vi.fn(),
  deleteRow: vi.fn(),
  getRow: vi.fn(),
  listRows: vi.fn(),
  updateRow: vi.fn(),
};

const checkoutParams: CheckoutSessionParams = {
  currency: Currency.NOK,
  customerInfo: {
    email: "buyer@example.com",
    firstName: "Ada",
    lastName: "Lovelace",
    phone: "12345678",
  },
  items: [
    {
      category: "Merch",
      name: "Campus hoodie",
      price: 499,
      productId: "product-1",
      product_type: "webshop_product",
      quantity: 2,
      title: "Campus hoodie",
      unit_price: 499,
    },
  ],
  reference: "checkout-reference",
  subtotal: 998,
  total: 998,
  userId: "user-1",
};

describe("createOrder", () => {
  beforeEach(() => {
    process.env.APPWRITE_DATABASE_ID = "app";
    process.env.APPWRITE_ORDERS_COLLECTION_ID = "orders";
    process.env.APPWRITE_WEBSHOP_PRODUCTS_COLLECTION_ID = "webshop_products";

    db.createRow.mockReset();
    db.deleteRow.mockReset();
    db.getRow.mockReset();
    db.listRows.mockReset();
    db.updateRow.mockReset();
    db.createRow.mockImplementation(
      async (
        _databaseId: string,
        _collectionId: string,
        rowId: string,
        data: Record<string, unknown>
      ) => ({ $id: rowId, ...data })
    );
    db.listRows.mockResolvedValue({ rows: [] });
  });

  it("stores checkout items with product_id for downstream stock and purchase-limit processing", async () => {
    await createOrder(checkoutParams, db);

    const storedOrder = db.createRow.mock.calls[0]?.[3] as Record<
      string,
      unknown
    >;
    const storedItems = JSON.parse(String(storedOrder.items_json)) as Record<
      string,
      unknown
    >[];

    expect(storedOrder.status).toBe(OrdersStatus.PENDING);
    expect(storedItems).toEqual([
      expect.objectContaining({
        product_id: "product-1",
        quantity: 2,
        unit_price: 499,
      }),
    ]);
    expect(storedItems[0]).not.toHaveProperty("productId");
  });

  it("creates orders through the provided DB client with buyer-scoped read permissions", async () => {
    await createOrder(checkoutParams, db);

    expect(db.createRow).toHaveBeenCalledWith(
      "app",
      "orders",
      expect.any(String),
      expect.objectContaining({
        status: OrdersStatus.PENDING,
        total: 998,
        userId: "user-1",
      }),
      ['read("user:user-1")']
    );
  });
});

describe("updateOrderWithSession", () => {
  beforeEach(() => {
    process.env.APPWRITE_DATABASE_ID = "app";
    process.env.APPWRITE_ORDERS_COLLECTION_ID = "orders";
    db.updateRow.mockReset();
    db.updateRow.mockResolvedValue({});
  });

  it("persists the canonical payment columns for a provider session", async () => {
    await updateOrderWithSession(
      "order-1",
      {
        provider: "stripe",
        sessionId: "cs_123",
        checkoutUrl: "https://pay.example/cs_123",
      },
      db
    );

    expect(db.updateRow).toHaveBeenCalledWith("app", "orders", "order-1", {
      payment_provider: "stripe",
      payment_session_id: "cs_123",
      payment_link: "https://pay.example/cs_123",
    });
  });
});

describe("applyOrderStatusTransition", () => {
  beforeEach(() => {
    process.env.APPWRITE_DATABASE_ID = "app";
    process.env.APPWRITE_ORDERS_COLLECTION_ID = "orders";
    process.env.APPWRITE_WEBSHOP_PRODUCTS_COLLECTION_ID = "webshop_products";

    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    db.createRow.mockReset();
    db.deleteRow.mockReset();
    db.getRow.mockReset();
    db.listRows.mockReset();
    db.updateRow.mockReset();
    db.listRows.mockResolvedValue({ rows: [] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("decrements stock and writes status plus extra columns for a paid transition", async () => {
    db.getRow.mockImplementation(
      (_databaseId: string, collectionId: string) => {
        if (collectionId === "orders") {
          return Promise.resolve({
            $id: "order-1",
            items_json: JSON.stringify([
              { product_id: "product-1", quantity: 2, unit_price: 499 },
            ]),
            status: OrdersStatus.PENDING,
            userId: "user-1",
          });
        }
        return Promise.resolve({ $id: "product-1", stock: 5 });
      }
    );

    const result = await applyOrderStatusTransition(
      "order-1",
      OrdersStatus.PAID,
      { payment_intent_id: "pi_1" },
      db
    );

    expect(result.newStatus).toBe(OrdersStatus.PAID);
    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "webshop_products",
      "product-1",
      { stock: 3 }
    );
    expect(db.updateRow).toHaveBeenCalledWith("app", "orders", "order-1", {
      status: OrdersStatus.PAID,
      payment_intent_id: "pi_1",
    });
  });

  it("restores stock when an authorized order transitions to cancelled", async () => {
    db.getRow.mockImplementation(
      (_databaseId: string, collectionId: string) => {
        if (collectionId === "orders") {
          return Promise.resolve({
            $id: "order-1",
            items_json: JSON.stringify([
              { product_id: "product-1", quantity: 2, unit_price: 499 },
            ]),
            status: OrdersStatus.AUTHORIZED,
            userId: "user-1",
          });
        }
        return Promise.resolve({ $id: "product-1", stock: 3 });
      }
    );

    const result = await applyOrderStatusTransition(
      "order-1",
      OrdersStatus.CANCELLED,
      {},
      db
    );

    expect(result.newStatus).toBe(OrdersStatus.CANCELLED);
    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "webshop_products",
      "product-1",
      { stock: 5 }
    );
  });

  it("does not decrement stock again when an already-authorized order stays authorized", async () => {
    db.getRow.mockImplementation(
      (_databaseId: string, collectionId: string) => {
        if (collectionId === "orders") {
          return Promise.resolve({
            $id: "order-1",
            items_json: JSON.stringify([
              { product_id: "product-1", quantity: 2, unit_price: 499 },
            ]),
            status: OrdersStatus.AUTHORIZED,
            userId: "user-1",
          });
        }
        return Promise.resolve({ $id: "product-1", stock: 5 });
      }
    );

    await applyOrderStatusTransition(
      "order-1",
      OrdersStatus.AUTHORIZED,
      {},
      db
    );

    // Only the order row is read; the product is never touched for stock.
    expect(db.getRow).toHaveBeenCalledTimes(1);
    expect(db.updateRow).not.toHaveBeenCalledWith(
      "app",
      "webshop_products",
      "product-1",
      expect.anything()
    );
    expect(db.listRows).not.toHaveBeenCalled();
  });

  it("deletes paid order reservations using structured Appwrite queries", async () => {
    db.listRows.mockResolvedValue({
      rows: [{ $id: "reservation-1" }, { $id: "reservation-2" }],
    });
    db.getRow.mockImplementation(
      (_databaseId: string, collectionId: string) => {
        if (collectionId === "orders") {
          return Promise.resolve({
            $id: "order-1",
            items_json: JSON.stringify([
              { product_id: "product-1", quantity: 1, unit_price: 499 },
            ]),
            status: OrdersStatus.PENDING,
            userId: "user-1",
          });
        }
        return Promise.resolve({ $id: "product-1", stock: 5 });
      }
    );

    await applyOrderStatusTransition("order-1", OrdersStatus.PAID, {}, db);

    expect(db.listRows).toHaveBeenCalledWith("app", "cart_reservations", [
      Query.equal("user_id", "user-1"),
    ]);
    expect(db.deleteRow).toHaveBeenCalledWith(
      "app",
      "cart_reservations",
      "reservation-1"
    );
    expect(db.deleteRow).toHaveBeenCalledWith(
      "app",
      "cart_reservations",
      "reservation-2"
    );
  });
});
