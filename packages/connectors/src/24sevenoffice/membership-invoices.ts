/**
 * 24SevenOffice membership invoices (read side).
 *
 * The roster sync needs each member's campus, which 24SO only records on the
 * membership invoice: the UserDefinedDimension with TypeId 101 whose Value is
 * the app's campus id (see `buildDimensions` in
 * `@repo/shared/utils/finago-membership-invoice`). DepartmentId is the
 * department, not the campus, and is deliberately ignored.
 */

import { getValidSession } from "./auth";
import { createAuthenticatedClient } from "./client";

/**
 * Mirrors `CAMPUS_DIMENSION_TYPE` in ./rest/departments — not imported, since
 * that module pulls in the REST client.
 */
const CAMPUS_DIMENSION_TYPE_ID = "101";

/** Customers per `GetInvoices` request; 1000 verified against the live API. */
export const CUSTOMER_ID_BATCH_SIZE = 1000;

type OneOrMany<T> = T | T[] | null | undefined;

interface Dimension {
  Name?: string;
  TypeId?: number | string;
  Value?: string;
}

interface DimensionList {
  UserDefinedDimension?: OneOrMany<Dimension>;
}

interface InvoiceRow {
  ProductId?: number | string;
  UserDefinedDimensions?: DimensionList | null;
}

interface InvoiceOrder {
  CustomerId?: number | string;
  CustomerName?: string;
  DateInvoiced?: string;
  DepartmentId?: number;
  InvoiceRows?: { InvoiceRow?: OneOrMany<InvoiceRow> } | null;
  UserDefinedDimensions?: DimensionList | null;
}

export interface GetInvoicesResponse {
  GetInvoicesResult?: { InvoiceOrder?: OneOrMany<InvoiceOrder> } | null;
}

export interface MembershipInvoiceLine {
  campusId: string | null;
  customerId: number;
  customerName: string | null;
  invoicedAt: string | null;
  productId: number;
}

function toArray<T>(value: OneOrMany<T>): T[] {
  if (value === undefined || value === null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function campusFrom(
  dimensions: DimensionList | null | undefined
): string | null {
  const campus = toArray(dimensions?.UserDefinedDimension).find(
    (d) => String(d.TypeId) === CAMPUS_DIMENSION_TYPE_ID
  );
  const value = campus?.Value?.trim();
  return value ? value : null;
}

/** One line per invoice row whose product is a membership product. */
export function parseMembershipInvoiceLines(
  result: GetInvoicesResponse,
  productIds: ReadonlySet<number>
): MembershipInvoiceLine[] {
  const lines: MembershipInvoiceLine[] = [];

  for (const order of toArray(result.GetInvoicesResult?.InvoiceOrder)) {
    const customerId = Number(order.CustomerId);
    if (!Number.isFinite(customerId)) {
      continue;
    }
    const orderCampus = campusFrom(order.UserDefinedDimensions);
    const customerName = order.CustomerName?.trim() || null;

    for (const row of toArray(order.InvoiceRows?.InvoiceRow)) {
      const productId = Number(row.ProductId);
      if (!productIds.has(productId)) {
        continue;
      }
      lines.push({
        campusId: orderCampus ?? campusFrom(row.UserDefinedDimensions),
        customerId,
        customerName,
        invoicedAt: order.DateInvoiced ?? null,
        productId,
      });
    }
  }

  return lines;
}

/**
 * Membership invoice lines for the given customers, 1000 customers per
 * request. Throws on any failed batch.
 */
export async function getMembershipInvoices(
  customerIds: number[],
  productIds: ReadonlySet<number>,
  options?: { timeoutMs?: number }
): Promise<MembershipInvoiceLine[]> {
  if (customerIds.length === 0 || productIds.size === 0) {
    return [];
  }

  const session = await getValidSession();
  const client = await createAuthenticatedClient("invoice", session);
  const lines: MembershipInvoiceLine[] = [];

  for (let i = 0; i < customerIds.length; i += CUSTOMER_ID_BATCH_SIZE) {
    const batch = customerIds.slice(i, i + CUSTOMER_ID_BATCH_SIZE);
    const [result]: [GetInvoicesResponse] = await client.GetInvoicesAsync(
      {
        // SOAP ArrayOfInt — a plain array is not accepted.
        searchParams: { CustomerIds: { int: batch } },
        invoiceReturnProperties: {
          string: [
            "CustomerId",
            "CustomerName",
            "DateInvoiced",
            "UserDefinedDimensions",
            "InvoiceRows",
          ],
        },
        rowReturnProperties: { string: ["ProductId", "UserDefinedDimensions"] },
      },
      options?.timeoutMs ? { timeout: options.timeoutMs } : undefined
    );
    lines.push(...parseMembershipInvoiceLines(result, productIds));
  }

  return lines;
}
