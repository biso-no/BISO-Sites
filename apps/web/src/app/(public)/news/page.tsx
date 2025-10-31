import Link from 'next/link'
import { listNews, listCampuses } from '@/app/actions/news'
import { getLocale } from '@/app/actions/locale'
import { Input } from '@repo/ui/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@repo/ui/components/ui/select'
import { PublicPageHeader } from '@/components/public/PublicPageHeader'
import Image from 'next/image'

export default async function PublicNewsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams
  const q = params.q || ''
  const campus = params.campus || 'all'
  // Enforce published news for public list
  const status = 'published'
  
  // Get user's preferred locale from their account preferences
  const locale = await getLocale()

  const campusFilter = campus !== 'all' ? campus : undefined

  const [news, campuses] = await Promise.all([
    listNews({ campus: campusFilter, status, search: q || undefined, limit: 100, locale }),
    listCampuses(),
  ])

  return (
    <div className="space-y-6">
      <PublicPageHeader
        title="News"
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'News' }]}
      />

      <div className="grid gap-4 md:grid-cols-4">
        <form className="contents">
          <Input name="q" defaultValue={q} placeholder="Search news..." className="md:col-span-2" />
          <Select name="campus" defaultValue={campus}>
            <SelectTrigger>
              <SelectValue placeholder="All campuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All campuses</SelectItem>
              {campuses.map(c => (
                <SelectItem key={c.$id} value={c.$id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Status is fixed to published in public listing */}
          <button type="submit" className="hidden" />
        </form>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {news.map(item => (
          <article key={(item as any).$id} className="border rounded-lg overflow-hidden bg-background/60 backdrop-blur-sm">
            {item.image && (
              <div className="relative w-full h-40">
                <Image src={item.image} alt={item.title} fill className="object-cover" />
              </div>
            )}
            <div className="p-4">
              <h3 className="font-semibold text-lg">
                <Link href={`/news/${(item as any).$id}`} className="underline-offset-4 hover:underline">{item.title}</Link>
              </h3>
              <div className="text-xs text-muted-foreground mb-2">
                {new Date(item.$createdAt).toLocaleDateString()}
                {item.campus?.name && <span> · {item.campus.name}</span>}
                {item.department?.Name && <span> · {item.department.Name}</span>}
              </div>
              <p className="text-sm text-muted-foreground line-clamp-3">{item.content?.replace(/<[^>]+>/g, '').slice(0, 150)}...</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

