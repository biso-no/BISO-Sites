'use server'

import { Query } from '@repo/api'
import { createSessionClient } from '@repo/api/server'
import type { Orders } from '@repo/api/types/appwrite'

const DATABASE_ID = 'app'
const ORDERS_TABLE = 'orders'

type ExportOrdersParams = {
  startDate?: string
  endDate?: string
}

type CsvResult = {
  filename: string
  content: string
}

type ParsedOrderItem = {
  product_id?: string
  product_slug?: string
  title?: string
  quantity?: number
  unit_price?: number
}

export async function exportOrdersToCSV(params: ExportOrdersParams): Promise<CsvResult> {
  const { db } = await createSessionClient()
  const { startIso, endIso } = normalizeRange(params.startDate, params.endDate)

  const baseQueries: unknown[] = [
    Query.select([
      '$id',
      '$createdAt',
      'status',
      'buyer_name',
      'buyer_email',
      'buyer_phone',
      'items_json',
      'total',
    ]),
    Query.orderAsc('$createdAt'),
  ]

  if (startIso) {
    baseQueries.push(Query.greaterThanEqual('$createdAt', startIso))
  }
  if (endIso) {
    baseQueries.push(Query.lessThanEqual('$createdAt', endIso))
  }

  const orders = await fetchAllOrders(db, baseQueries)
  const rows = buildCsvRows(orders)
  const filename = buildFilename(startIso, endIso)
  const content = rows.join('\n')

  return { filename, content }
}

async function fetchAllOrders(
  db: Awaited<ReturnType<typeof createSessionClient>>['db'],
  baseQueries: unknown[],
  batchSize = 200,
) {
  const allOrders: Orders[] = []
  let cursor: string | null = null

  while (true) {
    const queries = [...baseQueries, Query.limit(batchSize)]
    if (cursor) {
      queries.push(Query.cursorAfter(cursor))
    }

    const response = await db.listRows<Orders>(DATABASE_ID, ORDERS_TABLE, queries)
    const batch = response.rows ?? []
    if (!batch.length) break

    allOrders.push(...batch)
    if (batch.length < batchSize) break
    cursor = batch[batch.length - 1].$id
  }

  return allOrders
}

function buildCsvRows(orders: Orders[]) {
  const header = [
    'order_id',
    'date',
    'customer_name',
    'customer_email',
    'customer_phone',
    'product',
    'unit_price',
    'order_total',
    'status',
  ]

  const rows = [header.join(',')]

  for (const order of orders) {
    const createdAt = order.$createdAt
    const status = (order.status || 'pending').toLowerCase()
    const totalValue = Number(order.total ?? 0)
    const baseColumns = [
      order.$id,
      createdAt,
      order.buyer_name || '',
      order.buyer_email || '',
      order.buyer_phone || '',
    ]

    const items = parseOrderItems(order.items_json)
    if (items.length === 0) {
      rows.push(
        formatCsvRow([
          ...baseColumns,
          '',
          '',
          formatMoney(totalValue),
          status,
        ]),
      )
      continue
    }

    for (const item of items) {
      const quantity = Math.max(1, Math.floor(item.quantity ?? 1))
      const productLabel = item.title || item.product_slug || 'Product'
      const unitPrice = formatMoney(item.unit_price ?? 0)
      for (let i = 0; i < quantity; i++) {
        rows.push(
          formatCsvRow([
            ...baseColumns,
            productLabel,
            unitPrice,
            formatMoney(totalValue),
            status,
          ]),
        )
      }
    }
  }

  return rows
}

function parseOrderItems(json?: string | null): ParsedOrderItem[] {
  if (!json) return []
  try {
    const parsed = JSON.parse(json)
    return Array.isArray(parsed) ? (parsed as ParsedOrderItem[]) : []
  } catch {
    return []
  }
}

function formatCsvRow(columns: (string | number)[]) {
  return columns.map(escapeCsv).join(',')
}

function escapeCsv(value: string | number) {
  const stringValue = String(value ?? '')
  if (stringValue.includes('"') || stringValue.includes(',') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }
  return stringValue
}

function formatMoney(value: number) {
  return value.toFixed(2)
}

function buildFilename(startIso?: string, endIso?: string) {
  const start = startIso ? startIso.slice(0, 10) : 'all'
  const end = endIso ? endIso.slice(0, 10) : 'now'
  return `orders-${start}-to-${end}.csv`
}

function normalizeRange(start?: string, end?: string) {
  let startDate = start ? new Date(start) : undefined
  let endDate = end ? new Date(end) : undefined

  if (startDate && Number.isNaN(startDate.getTime())) {
    startDate = undefined
  }
  if (endDate && Number.isNaN(endDate.getTime())) {
    endDate = undefined
  }

  if (startDate && endDate && startDate > endDate) {
    const temp = startDate
    startDate = endDate
    endDate = temp
  }

  const startIso = startDate ? new Date(startDate).toISOString() : undefined
  const endIso = endDate ? new Date(endDate.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString() : undefined

  return { startIso, endIso }
}

