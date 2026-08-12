/**
 * Builds the 24SevenOffice `InvoiceOrder` payload for a membership purchase.
 *
 * Mirrors the payload the production membership tool (biso-no/funksjon) posts,
 * which is what BI's own student app produces, with two deliberate
 * differences:
 *   - OrderStatus is "Invoiced", not "Draft": the student has already paid by
 *     Vipps or Stripe, so there is nothing left for finance to collect.
 *   - AccrualDate comes from the plan's parsed semester start instead of a
 *     hardcoded date, so it does not rot at the next rollover.
 */

import {
  MEMBERSHIP_DIMENSION_IDS,
  MEMBERSHIP_DIMENSION_LABELS,
  type MembershipPlan,
} from "./membership-plans";

export const CAMPUS_INVOICE_DEPARTMENT_IDS: Record<string, number> = {
  "1": 1, // Oslo
  "2": 300, // Bergen
  "3": 600, // Trondheim
  "4": 800, // Stavanger
  "5": 1000, // National
};

export const CAMPUS_INVOICE_NAMES: Record<string, string> = {
  "1": "Oslo",
  "2": "Bergen",
  "3": "Trondheim",
  "4": "Stavanger",
  "5": "National",
};

export interface UserDefinedDimension {
  Name: string;
  Type: "UserDefined";
  TypeId: string;
  Value: string;
}

export interface MembershipInvoiceRow {
  DepartmentId: number;
  Price: number;
  ProductId: number;
  Quantity: number;
  UserDefinedDimensions: { UserDefinedDimension: UserDefinedDimension[] };
}

export interface MembershipInvoiceOrder {
  AccrualDate: string;
  AccrualLength: number;
  Addresses: {
    Delivery: { Country: string };
    Invoice: { Country: string };
  };
  CustomerId: number;
  DateInvoiced: string;
  DepartmentId: number;
  Distributor: string;
  InvoiceRows: { InvoiceRow: MembershipInvoiceRow };
  OrderStatus: "Invoiced";
  PaymentAmount: number;
  PaymentMethodId: number;
  PaymentTime: number;
  UserDefinedDimensions: { UserDefinedDimension: UserDefinedDimension[] };
}

export interface BuildMembershipInvoiceParams {
  campusId: string;
  customerId: number;
  invoicedOn: string;
  plan: MembershipPlan;
}

function buildDimensions(
  campusId: string,
  plan: MembershipPlan
): UserDefinedDimension[] {
  const campusName = CAMPUS_INVOICE_NAMES[campusId];
  if (campusName === undefined) {
    throw new Error(`Unknown campus id: ${campusId}`);
  }

  return [
    {
      Type: "UserDefined",
      Name: campusName,
      Value: campusId,
      TypeId: "101",
    },
    {
      Type: "UserDefined",
      Name: MEMBERSHIP_DIMENSION_IDS[plan.duration],
      Value: MEMBERSHIP_DIMENSION_LABELS[plan.duration],
      TypeId: "102",
    },
  ];
}

export function buildMembershipInvoiceOrder({
  campusId,
  customerId,
  invoicedOn,
  plan,
}: BuildMembershipInvoiceParams): MembershipInvoiceOrder {
  const departmentId = CAMPUS_INVOICE_DEPARTMENT_IDS[campusId];
  if (departmentId === undefined) {
    throw new Error(`Unknown campus id: ${campusId}`);
  }

  const dimensions = buildDimensions(campusId, plan);

  return {
    CustomerId: customerId,
    OrderStatus: "Invoiced",
    PaymentMethodId: 1,
    PaymentTime: 0,
    Distributor: "Manual",
    DateInvoiced: invoicedOn,
    PaymentAmount: plan.price,
    DepartmentId: departmentId,
    Addresses: {
      Delivery: { Country: "NO" },
      Invoice: { Country: "NO" },
    },
    InvoiceRows: {
      InvoiceRow: {
        ProductId: plan.productId,
        Price: plan.price,
        Quantity: 1,
        DepartmentId: departmentId,
        UserDefinedDimensions: { UserDefinedDimension: dimensions },
      },
    },
    AccrualDate: plan.startDate,
    AccrualLength: plan.accrualMonths,
    UserDefinedDimensions: { UserDefinedDimension: dimensions },
  };
}
