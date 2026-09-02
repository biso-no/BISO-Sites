import { describe, expect, it } from "vitest";
import {
  buildMembershipInvoiceOrder,
  CAMPUS_INVOICE_DEPARTMENT_IDS,
  CAMPUS_INVOICE_NAMES,
} from "./finago-membership-invoice";
import type { MembershipPlan } from "./membership-plans";

const yearPlan: MembershipPlan = {
  id: "71",
  name: "BISO Membership fall 2026 and spring 2027",
  price: 550,
  productId: 71,
  categoryId: 113_178,
  duration: "year",
  accrualMonths: 12,
  startDate: "2026-08-01",
  expiryDate: "2027-06-30",
};

function build(campusId = "2") {
  return buildMembershipInvoiceOrder({
    campusId,
    customerId: 1_715_738,
    plan: yearPlan,
    invoicedOn: "2026-08-12",
  });
}

describe("buildMembershipInvoiceOrder", () => {
  it("books against the customer as already invoiced", () => {
    const order = build();
    expect(order.CustomerId).toBe(1_715_738);
    expect(order.OrderStatus).toBe("Invoiced");
    expect(order.PaymentTime).toBe(0);
    expect(order.PaymentMethodId).toBe(1);
    expect(order.Distributor).toBe("Manual");
    expect(order.DateInvoiced).toBe("2026-08-12");
    expect(order.PaymentAmount).toBe(550);
  });

  it("maps the campus to its 24SO department at order and row level", () => {
    const order = build("2");
    expect(order.DepartmentId).toBe(300);
    expect(order.InvoiceRows.InvoiceRow.DepartmentId).toBe(300);
  });

  it("uses ProductId on the invoice row, never ProductNo", () => {
    // Regression guard: 1009/2004/3004 are ProductNo; 54/71/82 are ProductId.
    const order = build();
    expect(order.InvoiceRows.InvoiceRow.ProductId).toBe(71);
    expect(order.InvoiceRows.InvoiceRow.Price).toBe(550);
    expect(order.InvoiceRows.InvoiceRow.Quantity).toBe(1);
  });

  it("books the accrual from the half-year the purchase falls into", () => {
    // A membership bought in the summer half accrues from 1 July; one bought
    // in the spring half accrues from 1 January. It used to be sent as the
    // catalogue row's own `startDate`, so every invoice booked the same fixed
    // date whenever it was bought — and in `DD.MM.YYYY`, where the 24SO API
    // documents an ISO `date`.
    const order = build();
    expect(order.AccrualDate).toBe("2026-07-01");
    expect(order.AccrualLength).toBe(12);
  });

  it("prefers the accrual start snapshotted at checkout", () => {
    // Fulfilment can lag payment (a webhook retry, the reconcile cron). A
    // purchase made on 30 June must not book into July because it was
    // fulfilled a day later.
    const order = buildMembershipInvoiceOrder({
      campusId: "1",
      customerId: 1,
      plan: { ...yearPlan, startDate: "2026-01-01" },
      invoicedOn: "2026-07-02",
    });
    expect(order.AccrualDate).toBe("2026-01-01");
  });

  it("falls back to the invoice date for a legacy catalogue snapshot", () => {
    // Orders placed before checkout started snapshotting the accrual start
    // carry the catalogue row's own date, e.g. "01.07.2026". That is not an
    // accrual start and must never reach 24SO verbatim.
    const order = buildMembershipInvoiceOrder({
      campusId: "1",
      customerId: 1,
      plan: { ...yearPlan, startDate: "01.07.2026" },
      invoicedOn: "2027-03-14",
    });
    expect(order.AccrualDate).toBe("2027-01-01");
  });

  it("emits both user defined dimensions at order and row level", () => {
    const expected = [
      { Type: "UserDefined", Name: "Bergen", Value: "2", TypeId: "101" },
      { Type: "UserDefined", Name: "200", Value: "Year", TypeId: "102" },
    ];
    const order = build("2");
    expect(order.UserDefinedDimensions.UserDefinedDimension).toEqual(expected);
    expect(
      order.InvoiceRows.InvoiceRow.UserDefinedDimensions.UserDefinedDimension
    ).toEqual(expected);
  });

  it("carries the semester dimension for a semester plan", () => {
    const order = buildMembershipInvoiceOrder({
      campusId: "1",
      customerId: 1,
      plan: { ...yearPlan, duration: "semester", accrualMonths: 6 },
      invoicedOn: "2026-08-12",
    });
    expect(order.DepartmentId).toBe(1);
    expect(order.UserDefinedDimensions.UserDefinedDimension[1]).toEqual({
      Type: "UserDefined",
      Name: "100",
      Value: "Semester",
      TypeId: "102",
    });
  });

  it("sends empty Norwegian addresses", () => {
    const order = build();
    expect(order.Addresses.Invoice.Country).toBe("NO");
    expect(order.Addresses.Delivery.Country).toBe("NO");
  });

  it("throws on an unknown campus rather than defaulting to Oslo", () => {
    expect(() => build("99")).toThrow("Unknown campus id: 99");
  });

  it.each([
    "constructor",
    "toString",
    "__proto__",
  ])("throws on the inherited Object.prototype member %j instead of treating it as a valid campus", (campusId) => {
    expect(() => build(campusId)).toThrow(`Unknown campus id: ${campusId}`);
  });

  it("maps every campus to its 24SO department at order and row level with correct names", () => {
    const campuses: [string, number, string][] = [
      ["1", 1, "Oslo"],
      ["2", 300, "Bergen"],
      ["3", 600, "Trondheim"],
      ["4", 800, "Stavanger"],
      ["5", 1000, "National"],
    ];

    for (const [campusId, expectedDept, expectedName] of campuses) {
      const order = buildMembershipInvoiceOrder({
        campusId,
        customerId: 1_715_738,
        plan: yearPlan,
        invoicedOn: "2026-08-12",
      });

      expect(order.DepartmentId).toBe(expectedDept);
      expect(order.InvoiceRows.InvoiceRow.DepartmentId).toBe(expectedDept);
      expect(order.UserDefinedDimensions.UserDefinedDimension[0]).toEqual({
        Type: "UserDefined",
        Name: expectedName,
        Value: campusId,
        TypeId: "101",
      });
      expect(
        order.InvoiceRows.InvoiceRow.UserDefinedDimensions
          .UserDefinedDimension[0]
      ).toEqual({
        Type: "UserDefined",
        Name: expectedName,
        Value: campusId,
        TypeId: "101",
      });
    }
  });

  it("handles all membership durations correctly", () => {
    const durations: [
      "semester" | "year" | "three_years",
      string,
      string,
      6 | 12 | 36,
    ][] = [
      ["semester", "100", "Semester", 6],
      ["year", "200", "Year", 12],
      ["three_years", "300", "3 Years", 36],
    ];

    for (const [
      duration,
      expectedId,
      expectedLabel,
      expectedAccrual,
    ] of durations) {
      const order = buildMembershipInvoiceOrder({
        campusId: "2",
        customerId: 1_715_738,
        plan: { ...yearPlan, duration, accrualMonths: expectedAccrual },
        invoicedOn: "2026-08-12",
      });

      expect(order.UserDefinedDimensions.UserDefinedDimension[1]).toEqual({
        Type: "UserDefined",
        Name: expectedId,
        Value: expectedLabel,
        TypeId: "102",
      });
      expect(
        order.InvoiceRows.InvoiceRow.UserDefinedDimensions
          .UserDefinedDimension[1]
      ).toEqual({
        Type: "UserDefined",
        Name: expectedId,
        Value: expectedLabel,
        TypeId: "102",
      });
      expect(order.AccrualLength).toBe(expectedAccrual);
    }
  });

  it("ensures campus department and names records have identical key sets", () => {
    const deptKeys = Object.keys(CAMPUS_INVOICE_DEPARTMENT_IDS).sort();
    const nameKeys = Object.keys(CAMPUS_INVOICE_NAMES).sort();
    expect(deptKeys).toEqual(nameKeys);
  });
});
