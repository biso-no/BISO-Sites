/**
 * 24SevenOffice Invoice Service
 *
 * Creates invoices in 24SevenOffice for membership purchases.
 */

import { getValidSession } from "./auth";
import { createAuthenticatedClient } from "./client";

export type InvoiceRow = {
  ProductId: number;
  Price: number;
  Quantity: number;
  Name?: string;
  DiscountRate?: number;
  DepartmentId?: number;
};

export type InvoiceOrder = {
  OrderId?: number;
  CustomerId: number;
  OrderStatus?: "None" | "Registered" | "Invoiced" | "PartlyInvoiced";
  DateOrdered?: string;
  DateInvoiced?: string;
  PaymentTime?: number;
  DeliveryMethod?: string;
  Note?: string;
  OurReference?: string;
  YourReference?: string;
  InvoiceRows?: {
    InvoiceRow: InvoiceRow | InvoiceRow[];
  };
  DepartmentId?: number;
};

export type SaveInvoicesResult = {
  SaveInvoicesResult?: {
    InvoiceOrder?: InvoiceOrder | InvoiceOrder[];
    APIException?: {
      Type?: string;
      Message?: string;
    };
  };
};

/**
 * Campus to 24SevenOffice DepartmentId mapping
 */
export const CAMPUS_DEPARTMENT_IDS: Record<string, number> = {
  "1": 2, // Oslo
  "2": 301, // Bergen
  "3": 601, // Trondheim
  "4": 801, // Stavanger
  "5": 1002, // National
};

export const CAMPUS_NAMES: Record<string, string> = {
  "1": "Oslo",
  "2": "Bergen",
  "3": "Trondheim",
  "4": "Stavanger",
  "5": "National",
};

/**
 * Create a membership invoice in 24SevenOffice
 *
 * @param customerId - The 24SO customer/company ID
 * @param productId - The membership product ID from 24SO
 * @param productName - The membership product name
 * @param price - The invoice amount in NOK
 * @param campusId - The campus ID (1-5) for department assignment
 * @returns The created invoice order with OrderId
 */
export async function createMembershipInvoice(
  customerId: number,
  productId: number,
  productName: string,
  price: number,
  campusId: string
): Promise<InvoiceOrder> {
  const session = await getValidSession();
  const client = await createAuthenticatedClient("invoice", session);

  // Get department ID for the campus
  const departmentId = CAMPUS_DEPARTMENT_IDS[campusId];
  if (!departmentId) {
    throw new Error(`Invalid campus ID: ${campusId}`);
  }

  const invoiceOrder: InvoiceOrder = {
    CustomerId: customerId,
    OrderStatus: "Registered",
    DateOrdered: new Date().toISOString(),
    PaymentTime: 14, // 14 days payment term
    OurReference: "BISO Admin",
    Note: `Manual membership creation: ${productName}`,
    DepartmentId: departmentId,
    InvoiceRows: {
      InvoiceRow: {
        ProductId: productId,
        Price: price,
        Quantity: 1,
        Name: productName,
        DepartmentId: departmentId,
      },
    },
  };

  try {
    const [result]: [SaveInvoicesResult] = await client.SaveInvoicesAsync({
      invoices: {
        InvoiceOrder: invoiceOrder,
      },
    });

    // Check for API exceptions
    if (result.SaveInvoicesResult?.APIException?.Message) {
      throw new Error(
        `24SO Invoice Error: ${result.SaveInvoicesResult.APIException.Message}`
      );
    }

    const saved = result.SaveInvoicesResult?.InvoiceOrder;
    if (!saved) {
      throw new Error("Failed to create invoice - no result returned");
    }

    const invoice = Array.isArray(saved) ? saved[0] : saved;
    if (!invoice) {
      throw new Error("Failed to create invoice - empty result");
    }

    console.log(
      `[24SO Invoice] Created invoice for customer ${customerId}: Order ID ${invoice.OrderId}, Department ${departmentId}`
    );

    return invoice;
  } catch (error) {
    console.error("[24SO Invoice] Failed to create invoice:", error);
    throw error;
  }
}
