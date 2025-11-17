import { Suspense } from 'react'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/ui/components/ui/tabs"
import { getTranslations } from 'next-intl/server'

import { listProducts } from '@/app/actions/products'
import { ProductsTable } from './_components/products-table'
import { ProductActions } from './_components/product-actions'
import { ProductFilters } from './_components/product-filters'
import type { ProductWithTranslations } from '@/lib/types/product'

const LOW_STOCK_THRESHOLD = 10

type ProductsPageProps = {
  searchParams?: Record<string, string | string[] | undefined>
}

export default async function DashboardPage({ searchParams = {} }: ProductsPageProps) {
  const t = await getTranslations('adminShop')
  const filters = buildProductFilters(searchParams)
  const [products, filterSource] = await Promise.all([
    listProducts(filters),
    listProducts({ limit: 200 }),
  ])

  const filterOptions = buildFilterOptions(filterSource)
  const initialValues = buildInitialValues(searchParams)

  return (
    <div className="flex w-full flex-col">
      <div className="flex flex-col sm:gap-4">
        <main className="grid flex-1 items-start gap-4 md:gap-8">
          <Tabs defaultValue="all">
            <div className="flex items-center">
              <TabsList>
                <TabsTrigger value="all">{t('products.tabs.all')}</TabsTrigger>
                <TabsTrigger value="active">{t('products.tabs.active')}</TabsTrigger>
                <TabsTrigger value="draft">{t('products.tabs.draft')}</TabsTrigger>
                <TabsTrigger value="archived" className="hidden sm:flex">
                  {t('products.tabs.archived')}
                </TabsTrigger>
              </TabsList>
              <ProductActions />
            </div>
            <ProductFilters initialValues={initialValues} options={filterOptions} />
            <Suspense fallback={<div>{t('messages.loading')}</div>}>
              <ProductsTable products={products} />
            </Suspense>
          </Tabs>
        </main>
      </div>
    </div>
  )
}

function buildProductFilters(params: Record<string, string | string[] | undefined>) {
  const filters: Parameters<typeof listProducts>[0] = {}

  const search = getParam(params, 'q')
  if (search) filters.search = search

  const campus = getParam(params, 'campus')
  if (campus && campus !== 'all') filters.campus_id = campus

  const category = getParam(params, 'category')
  if (category && category !== 'all') filters.category = category

  const stock = getParam(params, 'stock')
  if (stock === 'in-stock') {
    filters.stock_min = 1
  } else if (stock === 'low-stock') {
    filters.stock_min = 1
    filters.stock_max = LOW_STOCK_THRESHOLD
  } else if (stock === 'out-of-stock') {
    filters.stock_max = 0
  }

  const priceMin = toNumber(getParam(params, 'priceMin'))
  if (priceMin !== undefined) {
    filters.price_min = priceMin
  }
  const priceMax = toNumber(getParam(params, 'priceMax'))
  if (priceMax !== undefined) {
    filters.price_max = priceMax
  }

  return filters
}

function buildFilterOptions(products: ProductWithTranslations[]) {
  const campusMap = new Map<string, string>()
  const categories = new Set<string>()

  products.forEach((product) => {
    if (product.campus_id) {
      campusMap.set(product.campus_id, product.campus?.name || product.campus_id)
    }
    if (product.category) {
      categories.add(product.category)
    }
  })

  return {
    campuses: Array.from(campusMap.entries()).map(([id, name]) => ({ id, name })),
    categories: Array.from(categories.values()).sort(),
  }
}

function buildInitialValues(params: Record<string, string | string[] | undefined>) {
  return {
    search: getParam(params, 'q') || '',
    campus: getParam(params, 'campus') || 'all',
    category: getParam(params, 'category') || 'all',
    stock: getParam(params, 'stock') || 'all',
    priceMin: getParam(params, 'priceMin') || '',
    priceMax: getParam(params, 'priceMax') || '',
  }
}

function getParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key]
  if (Array.isArray(value)) {
    return value[0]
  }
  return value
}

function toNumber(value?: string | null) {
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}