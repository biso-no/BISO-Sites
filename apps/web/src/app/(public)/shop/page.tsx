import { Suspense } from 'react'
import { listProducts } from '@/app/actions/webshop'
import { getLocale } from '@/app/actions/locale'
import { ShopListClient } from '@/components/shop/shop-list-client'
import { ShopHero } from '@/components/shop/shop-hero'
import { Skeleton } from '@repo/ui/components/ui/skeleton'

export const metadata = {
  title: 'Shop | BISO',
  description: 'Browse our selection of merch, trip deductibles, campus lockers, and memberships',
}

async function ShopList({ locale }: { locale: 'en' | 'no' }) {
  const products = await listProducts({
    locale,
    status: 'published',
    limit: 100,
  })
  
  // TODO: Get actual member status from auth
  const isMember = false
  
  return <ShopListClient products={products} isMember={isMember} />
}

function ShopListSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="space-y-4">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default async function ShopPage() {
  const locale = await getLocale()
  
  // TODO: Get actual member status from auth
  const isMember = false

  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white">
      <ShopHero isMember={isMember} />
      <Suspense fallback={<ShopListSkeleton />}>
        <ShopList locale={locale} />
      </Suspense>
    </div>
  )
}
