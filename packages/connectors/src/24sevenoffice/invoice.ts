/**
 * 24SevenOffice Invoice Service
 *
 * Thin SOAP transport. The payload is built by
 * `@repo/shared/utils/finago-membership-invoice`, which is where the campus
 * department map, accrual, and user-defined dimensions live and are tested.
 */

import { getValidSession } from "./auth";
import { createAuthenticatedClient } from "./client";

/**
 * Minimal structural view of the invoice payload. The canonical shape is
 * `MembershipInvoiceOrder` in `@repo/shared/utils/finago-membership-invoice`,
 * which is structurally assignable to this. It is not imported here because
 * `@repo/connectors` cannot depend on `@repo/shared` (workspace cycle) — this
 * module is pure transport and does not need the full shape.
 */
export interface MembershipInvoicePayload {
  CustomerId: number;
  [key: string]: unknown;
}

interface SaveInvoicesResult {
  SaveInvoicesResult?: {
    APIException?: { Message?: string; Type?: string };
    InvoiceOrder?: { OrderId?: number } | Array<{ OrderId?: number }>;
  };
}

/**
 * Post a prebuilt membership invoice. Returns the created 24SO OrderId.
 */
export async function postMembershipInvoice(
  order: MembershipInvoicePayload
): Promise<number> {
  const session = await getValidSession();
  const client = await createAuthenticatedClient("invoice", session);

  const [result]: [SaveInvoicesResult] = await client.SaveInvoicesAsync({
    invoices: { InvoiceOrder: order },
  });

  const apiMessage = result.SaveInvoicesResult?.APIException?.Message;
  if (apiMessage) {
    throw new Error(`24SO Invoice Error: ${apiMessage}`);
  }

  const saved = result.SaveInvoicesResult?.InvoiceOrder;
  const invoice = Array.isArray(saved) ? saved[0] : saved;
  if (!invoice?.OrderId) {
    throw new Error("Failed to create invoice - no OrderId returned");
  }

  console.log(
    `[24SO Invoice] Created membership invoice ${invoice.OrderId} for customer ${order.CustomerId}`
  );
  return invoice.OrderId;
}
