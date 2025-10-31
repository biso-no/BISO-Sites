import { getProducts } from '@/app/actions/products'
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/ui/card'
import Link from 'next/link'
import Image from 'next/image'
import { PublicPageHeader } from '@/components/public/PublicPageHeader'

export default async function PublicShopPage() {
  const products = await getProducts('in-stock')
  return (
    <div className="space-y-6">
      <PublicPageHeader
        title="Shop"
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Shop' }]}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p: any) => (
          <Card key={p.$id} className="overflow-hidden">
            {p.images?.[0] && (
              <div className="relative w-full h-48">
                <Image src={p.images[0]} alt={p.name} fill className="object-cover" />
              </div>
            )}
            <CardHeader>
              <CardTitle className="text-lg">{p.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-sm text-muted-foreground line-clamp-3">{p.description}</div>
              <div className="text-sm font-medium">{Number(p.price).toFixed(2)} kr</div>
              <div className="pt-2">
                <Link href={`/shop/${p.slug || p.$id}`} className="text-sm underline hover:no-underline">View</Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}


