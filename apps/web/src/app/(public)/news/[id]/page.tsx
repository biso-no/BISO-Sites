import { getNewsItem } from '@/app/actions/news'
import { getLocale } from '@/app/actions/locale'
import { notFound } from 'next/navigation'
import { PublicPageHeader } from '@/components/public/PublicPageHeader'
import Image from 'next/image'

export default async function PublicNewsDetail({ params }: { 
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  
  // Get user's preferred locale from their account preferences
  const locale = await getLocale()
  const item = await getNewsItem(id, locale)
  
  if (!item) return notFound()
  if ((item as any).status && (item as any).status !== 'published') {
    return notFound()
  }
  
  return (
    <div className="space-y-6">
      <PublicPageHeader
        title={item.title}
        subtitle={[
          new Date(item.$createdAt).toLocaleDateString(),
          item.campus?.name,
          item.department?.Name
        ].filter(Boolean).join(' · ')}
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'News', href: '/news' }, { label: item.title }]}
      />
      {item.image && (
        <div className="relative w-full h-64 rounded-lg overflow-hidden">
          <Image src={item.image} alt={item.title} fill className="object-cover" />
        </div>
      )}
      <article className="prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: item.content || '' }} />
    </div>
  )
}

