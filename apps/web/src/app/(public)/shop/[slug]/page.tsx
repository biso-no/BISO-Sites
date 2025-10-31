import { getProductBySlug } from '@/app/actions/products'
import { notFound } from 'next/navigation'
import { PublicPageHeader } from '@/components/public/PublicPageHeader'
import Image from 'next/image'
import { createSessionClient } from '@repo/api/server'
import { Card, CardContent } from '@repo/ui/components/ui/card'
import { getLocale } from '@/app/actions/locale'
import { ProductPurchaseClient } from './product-purchase-client'

async function maybeGetMemberPrice(product: any) {
  try {
    if (!product?.member_discount_enabled || !product?.member_discount_percent) return null
    const { account, db, functions } = await createSessionClient()
    const user = await account.get().catch(() => null)
    if (!user?.$id) return null
    const profile = await db.getDocument('app', 'user', user.$id).catch(() => null)
    const studentId = profile?.student_id
    if (!studentId) return null
    const exec = await functions.createExecution('verify_biso_membership', String(studentId), false)
    const res = JSON.parse(exec.responseBody || '{}')
    const isActive = !!res?.membership?.status
    if (!isActive) return null
    const discount = Number(product.member_discount_percent)
    const price = Number(product.price || 0)
    const discounted = Math.max(0, price * (1 - discount / 100))
    return { discounted, membership: res.membership }
  } catch {
    return null
  }
}

export default async function PublicProductDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const product = await getProductBySlug(slug, await getLocale())
  if (!product) return notFound()
  const member = await maybeGetMemberPrice(product)
  const basePrice = Number(product.price || 0)
  const subtitlePrice = member ? `${member.discounted.toFixed(2)} kr (member)` : `${basePrice.toFixed(2)} kr`

  return (
    <div className="space-y-6">
      <PublicPageHeader
        title={product.title || product.slug}
        subtitle={subtitlePrice}
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Shop', href: '/shop' }, { label: product.title || product.slug }]}
      />
      <div className="grid gap-8 md:grid-cols-2">
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {product.images?.[0] ? (
              <div className="relative h-96 w-full">
                <Image src={product.images[0]} alt={product.title || product.slug} fill className="object-cover" />
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <article className="prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: product.description || '' }} />

          <ProductPurchaseClient
            product={product}
            memberPricing={member}
          />
        </div>
      </div>
    </div>
  )
}

