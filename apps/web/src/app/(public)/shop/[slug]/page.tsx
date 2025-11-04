import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { getProductBySlug } from '@/app/actions/webshop'
import { getLocale } from '@/app/actions/locale'
import { ProductDetailsClient } from '@/components/shop/product-details-client'
import { Skeleton } from '@repo/ui/components/ui/skeleton'

interface ProductPageProps {
  params: {
    slug: string
  }
}

async function ProductDetails({ slug }: { slug: string }) {
  const locale = await getLocale()
  
  // Fetch the product
  const product = await getProductBySlug(slug, locale)
  
  if (!product) {
    notFound()
  }
  
  // TODO: Get actual member status from auth
  const isMember = false
  
  return <ProductDetailsClient product={product} isMember={isMember} />
}

function ProductDetailsSkeleton() {
  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white">
      <div className="relative h-[60vh]">
        <Skeleton className="w-full h-full" />
      </div>
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default async function ProductPage({ params }: ProductPageProps) {
  return (
    <Suspense fallback={<ProductDetailsSkeleton />}>
      <ProductDetails slug={params.slug} />
    </Suspense>
  )
}

// Generate metadata for SEO
export async function generateMetadata({ params }: ProductPageProps) {
  const locale = await getLocale()
  const product = await getProductBySlug(params.slug, locale)
  
  if (!product) {
    return {
      title: 'Product Not Found | BISO Shop',
    }
  }
  
  return {
    title: `${product.title} | BISO Shop`,
    description: product.short_description || product.description,
  }
}
