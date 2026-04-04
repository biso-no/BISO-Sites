"use server";

import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import type { Orders } from "@repo/api/types/appwrite";

const DATABASE_ID = "app";
const ORDERS_TABLE = "orders";

interface ExportOrdersParams {
  /** Filter by campus ID */
  campusId?: string;
  endDate?: string;
  /** Export format - "standard" for regular export, "booking" for 24SO-ready format */
  format?: "standard" | "booking";
  startDate?: string;
  /** Filter by order status. "all" includes all statuses. */
  status?: "all" | "paid" | "authorized" | "pending" | "cancelled";
}

interface CsvResult {
  content: string;
  filename: string;
}

interface ParsedOrderItem {
  category?: string;
  name?: string;
  price?: number;
  product_id?: string;
  product_slug?: string;
  product_type?: string;
  quantity?: number;
  title?: string;
  unit_price?: number;
}

export async function exportOrdersToCSV(
  params: ExportOrdersParams
): Promise<CsvResult> {
  const { db } = await createSessionClient();
  const { startIso, endIso } = normalizeRange(params.startDate, params.endDate);
  const format = params.format || "standard";

  const baseQueries: string[] = [
    Query.select([
      "$id",
      "$createdAt",
      "status",
      "buyer_name",
      "buyer_email",
      "buyer_phone",
      "items_json",
      "subtotal",
      "discount_total",
      "total",
      "campus_id",
      "membership_applied",
    ]),
    Query.orderAsc("$createdAt"),
  ];

  // Date range filters
  if (startIso) {
    baseQueries.push(Query.greaterThanEqual("$createdAt", startIso));
  }
  if (endIso) {
    baseQueries.push(Query.lessThanEqual("$createdAt", endIso));
  }

  // Status filter
  if (params.status && params.status !== "all") {
    baseQueries.push(Query.equal("status", params.status));
  }

  // Campus filter
  if (params.campusId) {
    baseQueries.push(Query.equal("campus_id", params.campusId));
  }

  const orders = await fetchAllOrders(db, baseQueries);
  const rows = buildCsvRows(orders, format);
  const filename = buildFilename(startIso, endIso, params.status, format);
  const content = rows.join("\n");

  return { filename, content };
}

async function fetchAllOrders(
  db: Awaited<ReturnType<typeof createSessionClient>>["db"],
  baseQueries: string[],
  batchSize = 200
) {
  const allOrders: Orders[] = [];
  let cursor: string | null = null;

  while (true) {
    const queries = [...baseQueries, Query.limit(batchSize)];
    if (cursor) {
      queries.push(Query.cursorAfter(cursor));
    }

    const response = await db.listRows<Orders>(
      DATABASE_ID,
      ORDERS_TABLE,
      queries
    );
    const batch = response.rows ?? [];
    if (!batch.length) {
      break;
    }

    allOrders.push(...batch);
    if (batch.length < batchSize) {
      break;
    }
    cursor = batch.at(-1)?.$id || null;
  }

  return allOrders;
}

const STANDARD_HEADER = [
  "order_id",
  "date",
  "customer_name",
  "customer_email",
  "customer_phone",
  "product",
  "unit_price",
  "order_total",
  "status",
];

const BOOKING_HEADER = [
  "order_id",
  "date",
  "customer_name",
  "customer_email",
  "customer_phone",
  "product",
  "product_category",
  "product_type",
  "unit_price",
  "quantity",
  "line_total",
  "subtotal",
  "discount",
  "order_total",
  "campus_id",
  "status",
  "membership_applied",
];

function buildOrderRowStandard(order: Orders): string[] {
  const status = (order.status || "pending").toLowerCase();
  const totalValue = Number(order.total ?? 0);
  const baseColumns = buildBaseColumns(order);
  const items = parseOrderItems(order.items_json);

  if (items.length === 0) {
    return [formatEmptyOrderRow(baseColumns, totalValue, status)];
  }

  return expandOrderItems(items, baseColumns, totalValue, status);
}

function buildOrderRowBooking(order: Orders): string[] {
  const status = (order.status || "pending").toLowerCase();
  const totalValue = Number(order.total ?? 0);
  const subtotal = Number(order.subtotal ?? 0);
  const discount = Number(order.discount_total ?? 0);
  const campusId = order.campus_id || "";
  const membershipApplied = order.membership_applied ? "Yes" : "No";
  const baseColumns = buildBaseColumns(order);
  const items = parseOrderItems(order.items_json);

  if (items.length === 0) {
    return [
      formatCsvRow([
        ...baseColumns,
        "", // product
        "", // category
        "", // type
        "", // unit_price
        "", // quantity
        "", // line_total
        formatMoney(subtotal),
        formatMoney(discount),
        formatMoney(totalValue),
        campusId,
        status,
        membershipApplied,
      ]),
    ];
  }

  return expandOrderItemsBooking(
    items,
    baseColumns,
    { subtotal, discount, total: totalValue, campusId, membershipApplied },
    status
  );
}

function buildCsvRows(orders: Orders[], format: "standard" | "booking") {
  const header = format === "booking" ? BOOKING_HEADER : STANDARD_HEADER;
  const rows = [header.join(",")];
  const buildRow =
    format === "booking" ? buildOrderRowBooking : buildOrderRowStandard;

  for (const order of orders) {
    rows.push(...buildRow(order));
  }

  return rows;
}

const buildBaseColumns = (order: Orders): (string | number)[] => [
  order.$id,
  order.$createdAt,
  order.buyer_name || "",
  order.buyer_email || "",
  order.buyer_phone || "",
];

const formatEmptyOrderRow = (
  baseColumns: (string | number)[],
  totalValue: number,
  status: string
) => formatCsvRow([...baseColumns, "", "", formatMoney(totalValue), status]);

const expandOrderItems = (
  items: ParsedOrderItem[],
  baseColumns: (string | number)[],
  totalValue: number,
  status: string
) => {
  const itemRows: string[] = [];

  for (const item of items) {
    const quantity = Math.max(1, Math.floor(item.quantity ?? 1));
    const productLabel =
      item.title || item.name || item.product_slug || "Product";
    const unitPrice = formatMoney(item.unit_price ?? item.price ?? 0);

    for (let i = 0; i < quantity; i++) {
      itemRows.push(
        formatCsvRow([
          ...baseColumns,
          productLabel,
          unitPrice,
          formatMoney(totalValue),
          status,
        ])
      );
    }
  }

  return itemRows;
};

interface BookingOrderContext {
  campusId: string;
  discount: number;
  membershipApplied: string;
  subtotal: number;
  total: number;
}

const expandOrderItemsBooking = (
  items: ParsedOrderItem[],
  baseColumns: (string | number)[],
  context: BookingOrderContext,
  status: string
) => {
  const itemRows: string[] = [];

  for (const item of items) {
    const quantity = Math.max(1, Math.floor(item.quantity ?? 1));
    const productLabel =
      item.title || item.name || item.product_slug || "Product";
    const category = item.category || "";
    const productType = item.product_type || "";
    const unitPrice = item.unit_price ?? item.price ?? 0;
    const lineTotal = unitPrice * quantity;

    itemRows.push(
      formatCsvRow([
        ...baseColumns,
        productLabel,
        category,
        productType,
        formatMoney(unitPrice),
        quantity,
        formatMoney(lineTotal),
        formatMoney(context.subtotal),
        formatMoney(context.discount),
        formatMoney(context.total),
        context.campusId,
        status,
        context.membershipApplied,
      ])
    );
  }

  return itemRows;
};

function parseOrderItems(json?: string | null): ParsedOrderItem[] {
  if (!json) {
    return [];
  }
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as ParsedOrderItem[]) : [];
  } catch {
    return [];
  }
}

function formatCsvRow(columns: (string | number)[]) {
  return columns.map(escapeCsv).join(",");
}

function escapeCsv(value: string | number) {
  const stringValue = String(value ?? "");
  if (
    stringValue.includes('"') ||
    stringValue.includes(",") ||
    stringValue.includes("\n")
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function formatMoney(value: number) {
  return value.toFixed(2);
}

function buildFilename(
  startIso?: string,
  endIso?: string,
  status?: string,
  format?: string
) {
  const start = startIso ? startIso.slice(0, 10) : "all";
  const end = endIso ? endIso.slice(0, 10) : "now";
  const statusSuffix = status && status !== "all" ? `-${status}` : "";
  const formatSuffix = format === "booking" ? "-booking" : "";
  return `orders-${start}-to-${end}${statusSuffix}${formatSuffix}.csv`;
}

function normalizeRange(start?: string, end?: string) {
  let startDate = start ? new Date(start) : undefined;
  let endDate = end ? new Date(end) : undefined;

  if (startDate && Number.isNaN(startDate.getTime())) {
    startDate = undefined;
  }
  if (endDate && Number.isNaN(endDate.getTime())) {
    endDate = undefined;
  }

  if (startDate && endDate && startDate > endDate) {
    const temp = startDate;
    startDate = endDate;
    endDate = temp;
  }

  const startIso = startDate ? new Date(startDate).toISOString() : undefined;
  const endIso = endDate
    ? new Date(endDate.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString()
    : undefined;

  return { startIso, endIso };
}
