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
  incrementRowColumn: vi.fn(),
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

  it("persists variant and custom-field metadata in the reader's snake_case shape", async () => {
    await createOrder(
      {
        ...checkoutParams,
        items: [
          {
            ...checkoutParams.items[0],
            variationId: "v-large",
            variationName: "Large",
            customFields: { engraving: "Ada", gift: "yes" },
            customFieldLabels: { engraving: "Engraving text" },
          },
        ],
      },
      db
    );

    const storedOrder = db.createRow.mock.calls[0]?.[3] as Record<
      string,
      unknown
    >;
    const storedItems = JSON.parse(String(storedOrder.items_json)) as Record<
      string,
      unknown
    >[];

    expect(storedItems[0]).toMatchObject({
      product_id: "product-1",
      variation_id: "v-large",
      variation_name: "Large",
      custom_fields: [
        // label falls back to the field id when no label is supplied.
        { id: "engraving", label: "Engraving text", value: "Ada" },
        { id: "gift", label: "gift", value: "yes" },
      ],
    });
    // The camelCase input keys must not leak into the persisted item.
    for (const key of [
      "variationId",
      "variationName",
      "customFields",
      "customFieldLabels",
    ]) {
      expect(storedItems[0]).not.toHaveProperty(key);
    }
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
    db.incrementRowColumn.mockReset();
    db.listRows.mockResolvedValue({ rows: [] });
    db.incrementRowColumn.mockResolvedValue({ transition_lock: 1 });
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
    // The base client exposes incrementRowColumn, so restore is atomic.
    expect(db.incrementRowColumn).toHaveBeenCalledWith({
      databaseId: "app",
      tableId: "webshop_products",
      rowId: "product-1",
      column: "stock",
      value: 2,
    });
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

  it("ignores a stale event that would regress a paid order back to pending", async () => {
    db.getRow.mockImplementation(
      (_databaseId: string, collectionId: string) => {
        if (collectionId === "orders") {
          return Promise.resolve({
            $id: "order-1",
            items_json: JSON.stringify([
              { product_id: "product-1", quantity: 2, unit_price: 499 },
            ]),
            status: OrdersStatus.PAID,
            userId: "user-1",
          });
        }
        return Promise.resolve({ $id: "product-1", stock: 3 });
      }
    );

    // A late Stripe `complete/unpaid` event maps to PENDING and arrives after
    // the order already settled — it must be dropped, not applied.
    const result = await applyOrderStatusTransition(
      "order-1",
      OrdersStatus.PENDING,
      {},
      db
    );

    expect(result.newStatus).toBe(OrdersStatus.PAID);
    // Only the order row was read; nothing was written or restocked.
    expect(db.getRow).toHaveBeenCalledTimes(1);
    expect(db.updateRow).not.toHaveBeenCalled();
    expect(db.incrementRowColumn).not.toHaveBeenCalled();
  });

  it("still allows a paid order to move forward to refunded", async () => {
    db.getRow.mockImplementation(
      (_databaseId: string, collectionId: string) => {
        if (collectionId === "orders") {
          return Promise.resolve({
            $id: "order-1",
            items_json: JSON.stringify([
              { product_id: "product-1", quantity: 1, unit_price: 499 },
            ]),
            status: OrdersStatus.PAID,
            userId: "user-1",
          });
        }
        return Promise.resolve({ $id: "product-1", stock: 4 });
      }
    );

    const result = await applyOrderStatusTransition(
      "order-1",
      OrdersStatus.REFUNDED,
      {},
      db
    );

    expect(result.newStatus).toBe(OrdersStatus.REFUNDED);
    expect(db.updateRow).toHaveBeenCalledWith("app", "orders", "order-1", {
      status: OrdersStatus.REFUNDED,
    });
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
      Query.equal("product_id", ["product-1"]),
      Query.limit(100),
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

  it("persists status without re-decrementing stock when the claim lock is lost", async () => {
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

    // Simulate lost race: increment returns a lock value > 1
    db.incrementRowColumn.mockResolvedValue({ transition_lock: 2 });

    const result = await applyOrderStatusTransition(
      "order-1",
      OrdersStatus.PAID,
      { payment_intent_id: "pi_1" },
      db
    );

    expect(result.newStatus).toBe(OrdersStatus.PAID);
    expect(db.incrementRowColumn).toHaveBeenCalled();
    // Stock is NOT touched — the winner owns that decrement.
    expect(db.updateRow).not.toHaveBeenCalledWith(
      "app",
      "webshop_products",
      "product-1",
      expect.anything()
    );
    expect(db.deleteRow).not.toHaveBeenCalled();
    // ...but the status IS still persisted so the order can't get stuck pending.
    expect(db.updateRow).toHaveBeenCalledWith("app", "orders", "order-1", {
      status: OrdersStatus.PAID,
      payment_intent_id: "pi_1",
    });
  });

  it("proceeds with decrement when atomic claim lock is won", async () => {
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

    // Simulate won race: increment returns exactly 1
    db.incrementRowColumn.mockResolvedValue({ transition_lock: 1 });

    const result = await applyOrderStatusTransition(
      "order-1",
      OrdersStatus.PAID,
      {},
      db
    );

    expect(result.newStatus).toBe(OrdersStatus.PAID);
    expect(db.incrementRowColumn).toHaveBeenCalled();
    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "webshop_products",
      "product-1",
      { stock: 3 }
    );
  });
});

describe("applyOrderStatusTransition with atomic column ops", () => {
  const atomicDb = {
    ...db,
    decrementRowColumn: vi.fn(),
  };

  function mockOrderAndProduct(status: OrdersStatus, stock: number) {
    atomicDb.getRow.mockImplementation(
      (_databaseId: string, collectionId: string) => {
        if (collectionId === "orders") {
          return Promise.resolve({
            $id: "order-1",
            items_json: JSON.stringify([
              { product_id: "product-1", quantity: 2, unit_price: 499 },
            ]),
            status,
            userId: "user-1",
          });
        }
        return Promise.resolve({ $id: "product-1", stock });
      }
    );
  }

  beforeEach(() => {
    process.env.APPWRITE_DATABASE_ID = "app";
    process.env.APPWRITE_ORDERS_COLLECTION_ID = "orders";
    process.env.APPWRITE_WEBSHOP_PRODUCTS_COLLECTION_ID = "webshop_products";

    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    atomicDb.deleteRow.mockReset();
    atomicDb.getRow.mockReset();
    atomicDb.listRows.mockReset();
    atomicDb.updateRow.mockReset();
    atomicDb.incrementRowColumn.mockReset();
    atomicDb.decrementRowColumn.mockReset();
    atomicDb.listRows.mockResolvedValue({ rows: [] });
    atomicDb.incrementRowColumn.mockResolvedValue({ transition_lock: 1 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("decrements stock atomically with a zero floor instead of read-modify-write", async () => {
    mockOrderAndProduct(OrdersStatus.PENDING, 5);
    atomicDb.decrementRowColumn.mockResolvedValue({
      $id: "product-1",
      stock: 3,
    });

    await applyOrderStatusTransition(
      "order-1",
      OrdersStatus.PAID,
      {},
      atomicDb
    );

    expect(atomicDb.decrementRowColumn).toHaveBeenCalledWith({
      databaseId: "app",
      tableId: "webshop_products",
      rowId: "product-1",
      column: "stock",
      value: 2,
      min: 0,
    });
    // No RMW write against the product row.
    expect(atomicDb.updateRow).not.toHaveBeenCalledWith(
      "app",
      "webshop_products",
      "product-1",
      expect.anything()
    );
  });

  it("floors stock to zero loudly when the atomic decrement detects an oversell", async () => {
    mockOrderAndProduct(OrdersStatus.PENDING, 1);
    atomicDb.decrementRowColumn.mockRejectedValue(
      new Error("Value would go below minimum")
    );

    const result = await applyOrderStatusTransition(
      "order-1",
      OrdersStatus.PAID,
      {},
      atomicDb
    );

    // The paid transition still completes — the buyer already paid.
    expect(result.newStatus).toBe(OrdersStatus.PAID);
    expect(atomicDb.updateRow).toHaveBeenCalledWith(
      "app",
      "webshop_products",
      "product-1",
      { stock: 0 }
    );
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("OVERSELL")
    );
  });

  it("restores stock atomically when an authorized order is cancelled", async () => {
    mockOrderAndProduct(OrdersStatus.AUTHORIZED, 3);
    atomicDb.incrementRowColumn.mockResolvedValue({
      $id: "product-1",
      stock: 5,
    });

    await applyOrderStatusTransition(
      "order-1",
      OrdersStatus.CANCELLED,
      {},
      atomicDb
    );

    expect(atomicDb.incrementRowColumn).toHaveBeenCalledWith({
      databaseId: "app",
      tableId: "webshop_products",
      rowId: "product-1",
      column: "stock",
      value: 2,
    });
    expect(atomicDb.updateRow).not.toHaveBeenCalledWith(
      "app",
      "webshop_products",
      "product-1",
      expect.anything()
    );
  });
});
