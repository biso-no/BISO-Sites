import { Suspense } from 'react'
import Link from "next/link"
import { Search } from "lucide-react"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@repo/ui/components/ui/breadcrumb"
import { Input } from "@repo/ui/components/ui/input"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/ui/components/ui/tabs"

import { listProducts } from '@/app/actions/products'
import { ProductsTable } from './_components/products-table'
import { ProductActions } from './_components/product-actions'

export default async function DashboardPage() {
  // Don't filter by locale for admin view - show all products
  const products = await listProducts({})

  return (
    <div className="flex w-full flex-col">
      <div className="flex flex-col sm:gap-4">
        <main className="grid flex-1 items-start gap-4 md:gap-8">
          <Tabs defaultValue="all">
            <div className="flex items-center">
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="draft">Draft</TabsTrigger>
                <TabsTrigger value="archived" className="hidden sm:flex">
                  Archived
                </TabsTrigger>
              </TabsList>
              <ProductActions />
            </div>
            <Suspense fallback={<div>Loading...</div>}>
              <ProductsTable products={products} />
            </Suspense>
          </Tabs>
        </main>
      </div>
    </div>
  )
}