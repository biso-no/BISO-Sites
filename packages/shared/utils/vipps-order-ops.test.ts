import { OrdersStatus } from "@repo/api/types/appwrite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type CheckoutSessionParams,
  Currency,
  type VippsPaymentState,
} from "../types/vipps";
import { createOrder, updateOrderStatus } from "./vipps-order-ops";

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
});

describe("updateOrderStatus", () => {
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

  it("decrements stock when authorizing a legacy order with productId item keys", async () => {
    db.getRow.mockImplementation(
      (_databaseId: string, collectionId: string) => {
        if (collectionId === "orders") {
          return Promise.resolve({
            $id: "order-1",
            items_json: JSON.stringify([
              {
                productId: "product-1",
                quantity: 2,
                unit_price: 499,
              },
            ]),
            status: OrdersStatus.PENDING,
            userId: "user-1",
          });
        }

        return Promise.resolve({
          $id: "product-1",
          stock: 5,
        });
      }
    );

    await updateOrderStatus(
      "order-1",
      { state: "AUTHORIZED" } as VippsPaymentState,
      { payment: { aggregate: { authorizedAmount: { value: 99_800 } } } },
      db
    );

    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "webshop_products",
      "product-1",
      { stock: 3 }
    );
    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "orders",
      "order-1",
      expect.objectContaining({ status: OrdersStatus.AUTHORIZED })
    );
  });
});
