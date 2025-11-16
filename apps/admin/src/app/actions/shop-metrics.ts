'use server'

import { Query } from '@repo/api'
import type { Models } from '@repo/api'
import { createSessionClient } from '@repo/api/server'
import type { Orders, WebshopProducts } from '@repo/api/types/appwrite'

const DATABASE_ID = 'app'
const ORDERS_TABLE = 'orders'
const PRODUCTS_TABLE = 'webshop_products'
const COMPLETED_STATUSES: string[] = ['paid', 'authorized']
const PUBLISHED_STATUS = 'published'

type TrendDirection = 'up' | 'down' | 'flat'

export interface MetricTrend {
  absolute: number
  percent: number
  direction: TrendDirection
  label: string
}

export interface MetricSummary {
  value: number
  trend: MetricTrend
}

export interface ShopMetrics {
  revenue: MetricSummary
  catalog: MetricSummary
  sales: MetricSummary
  activeCatalog: MetricSummary
}

type DbClient = Awaited<ReturnType<typeof createSessionClient>>['db']

type SimplifiedOrder = {
  id: string
  createdAt: Date
  total: number
}

type SimplifiedProduct = {
  id: string
  createdAt: Date
  status: string
}

export async function getShopMetrics(): Promise<ShopMetrics> {
  const { db } = await createSessionClient()

  const [orders, products] = await Promise.all([
    fetchAllRows<Orders>(db, ORDERS_TABLE, [
      Query.select(['$id', '$createdAt', 'status', 'total']),
      Query.orderAsc('$createdAt'),
      Query.equal('status', COMPLETED_STATUSES),
    ]),
    fetchAllRows<WebshopProducts>(db, PRODUCTS_TABLE, [
      Query.select(['$id', '$createdAt', 'status']),
      Query.orderAsc('$createdAt'),
    ]),
  ])

  const normalizedOrders: SimplifiedOrder[] = orders.map((order) => ({
    id: order.$id,
    createdAt: new Date(order.$createdAt),
    total: Number(order.total) || 0,
  }))

  const normalizedProducts: SimplifiedProduct[] = products.map((product) => ({
    id: product.$id,
    createdAt: new Date(product.$createdAt),
    status: typeof product.status === 'string' ? product.status : String(product.status),
  }))

  const now = new Date()
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)

  const totalRevenue = normalizedOrders.reduce((sum, order) => sum + order.total, 0)
  const revenueThisMonth = sumInRange(normalizedOrders, startOfThisMonth, now)
  const revenueLastMonth = sumInRange(normalizedOrders, startOfLastMonth, startOfThisMonth)

  const totalSales = normalizedOrders.length
  const salesThisMonth = countInRange(normalizedOrders, startOfThisMonth, now)
  const salesLastMonth = countInRange(normalizedOrders, startOfLastMonth, startOfThisMonth)

  const totalProducts = normalizedProducts.length
  const publishedProducts = normalizedProducts.filter((product) => product.status === PUBLISHED_STATUS).length
  const productsCreatedThisMonth = countInRange(normalizedProducts, startOfThisMonth, now)
  const productsCreatedLastMonth = countInRange(normalizedProducts, startOfLastMonth, startOfThisMonth)
  const publishedThisMonth = normalizedProducts.filter(
    (product) => product.status === PUBLISHED_STATUS && product.createdAt >= startOfThisMonth && product.createdAt < now,
  ).length
  const publishedLastMonth = normalizedProducts.filter(
    (product) => product.status === PUBLISHED_STATUS && product.createdAt >= startOfLastMonth && product.createdAt < startOfThisMonth,
  ).length

  return {
    revenue: {
      value: totalRevenue,
      trend: buildTrend(revenueThisMonth, revenueLastMonth),
    },
    catalog: {
      value: totalProducts,
      trend: buildTrend(productsCreatedThisMonth, productsCreatedLastMonth),
    },
    sales: {
      value: totalSales,
      trend: buildTrend(salesThisMonth, salesLastMonth),
    },
    activeCatalog: {
      value: publishedProducts,
      trend: buildTrend(publishedThisMonth, publishedLastMonth),
    },
  }
}

async function fetchAllRows<T extends Models.Row>(
  db: DbClient,
  table: string,
  baseQueries: string[],
  batchSize = 200,
): Promise<T[]> {
  const rows: T[] = []
  let cursor: string | null = null

  while (true) {
    const queries = [...baseQueries, Query.limit(batchSize)]
    if (cursor) {
      queries.push(Query.cursorAfter(cursor))
    }

    const response = await db.listRows<T>(DATABASE_ID, table, queries)
    const batch = response.rows ?? []
    if (!batch.length) {
      break
    }

    rows.push(...batch)
    if (batch.length < batchSize) {
      break
    }

    const last = batch[batch.length - 1]
    cursor = last?.$id ?? null
    if (!cursor) {
      break
    }
  }

  return rows
}

function sumInRange(items: SimplifiedOrder[], start: Date, end: Date) {
  return items.reduce((sum, item) => {
    if (item.createdAt >= start && item.createdAt < end) {
      return sum + item.total
    }
    return sum
  }, 0)
}

function countInRange(items: Array<{ createdAt: Date }>, start: Date, end: Date) {
  return items.reduce((count, item) => {
    if (item.createdAt >= start && item.createdAt < end) {
      return count + 1
    }
    return count
  }, 0)
}

function buildTrend(current: number, previous: number, label = 'vs last month'): MetricTrend {
  const absolute = current - previous
  const percent =
    previous === 0 ? (current > 0 ? 100 : 0) : Number((((current - previous) / previous) * 100).toFixed(1))

  let direction: TrendDirection = 'flat'
  if (absolute > 0) {
    direction = 'up'
  } else if (absolute < 0) {
    direction = 'down'
  }

  return {
    absolute,
    percent,
    direction,
    label,
  }
}

