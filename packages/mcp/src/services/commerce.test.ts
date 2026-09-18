/**
 * Commerce read scope.
 *
 * The hazard these tests pin: `orders` carries a table-level
 * `read("team:sg-app-dept-operationsunit")` grant, so Appwrite answering a
 * `getRow` proves only that the caller is in that team — not that the order is
 * within their campus. A member of the Operations Unit team who is *not* also
 * in Campus-National is an ordinary department principal, whom `searchOrders`
 * correctly shows nothing; without an explicit check the by-id path would hand
 * them buyer names, e-mail addresses, totals and line items for every campus.
 */

import { describe, expect, test } from "bun:test";
import { DomainError } from "../runtime/errors";
import {
  CAMPUS_ADMIN,
  createFakeBackend,
  DEPARTMENT_MEMBER,
  GLOBAL_ADMIN,
} from "../testing/index";
import { createCommerceService } from "./commerce";

const ORDERS = [
  {
    $id: "order-oslo",
    campus_id: "1",
    status: "completed",
    buyer_name: "Oslo Buyer",
    buyer_email: "oslo@example.com",
    total: 500,
    currency: "NOK",
    order_items: [],
  },
  {
    $id: "order-bergen",
    campus_id: "2",
    status: "completed",
    buyer_name: "Bergen Buyer",
    buyer_email: "bergen@example.com",
    total: 900,
    currency: "NOK",
    order_items: [],
  },
];

function service() {
  return createCommerceService(
    createFakeBackend({ tables: { orders: ORDERS } })
  );
}

async function expectNotFound(promise: Promise<unknown>) {
  let thrown: unknown;
  try {
    await promise;
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(DomainError);
  // `not_found`, never `forbidden`: an order id is guessable, and distinguishing
  // "exists but denied" from "does not exist" would confirm its existence.
  expect((thrown as DomainError).code).toBe("not_found");
  return thrown as DomainError;
}

describe("getOrder scope", () => {
  test("a campus admin reads an order from their own campus", async () => {
    const detail = await service().getOrder(
      CAMPUS_ADMIN("Oslo", "1"),
      "order-oslo"
    );
    expect(detail.id).toBe("order-oslo");
    expect(detail.buyerEmail).toBe("oslo@example.com");
  });

  test("a campus admin cannot read another campus's order by id", async () => {
    await expectNotFound(
      service().getOrder(CAMPUS_ADMIN("Oslo", "1"), "order-bergen")
    );
  });

  test("a department member reads no order by id, even one in their own campus", async () => {
    // `orders` has no department column, so `searchOrders` fails them closed.
    // The by-id path must agree rather than fall back to the table grant.
    await expectNotFound(service().getOrder(DEPARTMENT_MEMBER(), "order-oslo"));
  });

  test("a refused read leaks nothing about the order", async () => {
    const error = await expectNotFound(
      service().getOrder(CAMPUS_ADMIN("Oslo", "1"), "order-bergen")
    );
    const serialized = JSON.stringify(error.details ?? {});
    expect(serialized).not.toContain("Bergen Buyer");
    expect(serialized).not.toContain("bergen@example.com");
    expect(serialized).not.toContain("900");
  });

  test("a global admin reads any campus's order", async () => {
    const detail = await service().getOrder(GLOBAL_ADMIN(), "order-bergen");
    expect(detail.id).toBe("order-bergen");
  });

  test("searchOrders and getOrder agree on what a principal may see", async () => {
    const principal = CAMPUS_ADMIN("Oslo", "1");
    const listed = await service().searchOrders(principal, {
      limit: 20,
      offset: 0,
    });
    const listedIds = listed.rows.map((row) => row.id);
    expect(listedIds).toEqual(["order-oslo"]);

    for (const order of ORDERS) {
      if (listedIds.includes(order.$id)) {
        continue;
      }
      await expectNotFound(service().getOrder(principal, order.$id));
    }
  });
});
