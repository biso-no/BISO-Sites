import { expect, test } from "bun:test";
import { parseMembershipInvoiceLines } from "./membership-invoices";

const products = new Set([54]);

test("reads campus from the order-level dimension 101 and keeps membership rows only", () => {
  const lines = parseMembershipInvoiceLines(
    {
      GetInvoicesResult: {
        InvoiceOrder: {
          CustomerId: 3975,
          CustomerName: "Fathi Abdirahman",
          DateInvoiced: "2025-11-27T14:00:00Z",
          DepartmentId: 22,
          InvoiceRows: {
            InvoiceRow: [
              { ProductId: -1 },
              { ProductId: 54 },
              { ProductId: 39 },
            ],
          },
          UserDefinedDimensions: {
            UserDefinedDimension: [
              { Name: "Oslo", TypeId: 101, Value: "1" },
              { Name: "Semester", TypeId: 102, Value: "100" },
            ],
          },
        },
      },
    },
    products
  );
  expect(lines).toEqual([
    {
      campusId: "1",
      customerId: 3975,
      customerName: "Fathi Abdirahman",
      invoicedAt: "2025-11-27T14:00:00Z",
      productId: 54,
    },
  ]);
});

test("falls back to the row-level dimension and handles single-object shapes", () => {
  const lines = parseMembershipInvoiceLines(
    {
      GetInvoicesResult: {
        InvoiceOrder: [
          {
            CustomerId: 1,
            InvoiceRows: {
              InvoiceRow: {
                ProductId: 54,
                UserDefinedDimensions: {
                  UserDefinedDimension: { TypeId: "101", Value: "2" },
                },
              },
            },
            UserDefinedDimensions: null,
          },
        ],
      },
    },
    products
  );
  expect(lines).toEqual([
    {
      campusId: "2",
      customerId: 1,
      customerName: null,
      invoicedAt: null,
      productId: 54,
    },
  ]);
});

test("campus is null when no dimension 101 exists", () => {
  const lines = parseMembershipInvoiceLines(
    {
      GetInvoicesResult: {
        InvoiceOrder: {
          CustomerId: 1,
          InvoiceRows: { InvoiceRow: { ProductId: 54 } },
        },
      },
    },
    products
  );
  expect(lines[0]?.campusId).toBeNull();
});

test("empty result yields no lines", () => {
  expect(parseMembershipInvoiceLines({}, products)).toEqual([]);
});
