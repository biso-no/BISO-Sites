import { listEvents, listCampuses } from '@/app/actions/events'
import { getLocale } from '@/app/actions/locale'
import { Card, CardHeader, CardTitle, CardContent } from '@repo/ui/components/ui/card'
import { Input } from '@repo/ui/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@repo/ui/components/ui/select'
import Link from 'next/link'
import Image from 'next/image'
import { PublicPageHeader } from '@/components/public/PublicPageHeader'

export default async function PublicEventsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams
  const campus = params.campus
  // Enforce published events for public list
  const status = 'published'
  const q = params.q
  
  // Get user's preferred locale from their account preferences
  const locale = await getLocale()

  const campusFilter = campus && campus !== 'all' ? campus : undefined

  const [events, campuses] = await Promise.all([
    listEvents({ campus: campusFilter, status, search: q || undefined, limit: 100, locale }),
    listCampuses(),
  ])

  return (
    <div className="space-y-6">
      <PublicPageHeader
        title="Events"
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Events' }]}
      />

      <Card>
        <CardHeader>
          <CardTitle>Filter</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <form className="contents">
            <Input defaultValue={q || ''} name="q" placeholder="Search events..." className="md:col-span-2" />
            <Select name="campus" defaultValue={campus || 'all'}>
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
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {events.map(ev => (
          <Card key={(ev as any).$id} className="overflow-hidden">
            {ev.image && (
              <div className="relative w-full h-40">
                {/* @ts-ignore */}
                <Image src={typeof ev.image === 'string' ? ev.image : ''} alt={ev.title} fill className="object-cover" />
              </div>
            )}
            <CardContent className="p-4 space-y-2">
              <h3 className="font-semibold text-lg">{ev.title}</h3>
              <p className="text-sm text-muted-foreground line-clamp-3">{ev.description}</p>
              <div className="text-xs text-muted-foreground">
                <span>{new Date(ev.start_date).toLocaleDateString()}</span>
                {ev.end_date && <span> - {new Date(ev.end_date).toLocaleDateString()}</span>}
                {ev.location && <span> • {ev.location}</span>}
                {ev.price && <span> • {ev.price} NOK</span>}
              </div>
            </CardContent>
            <div className="px-4 py-3 border-t bg-muted/20 flex justify-end">
              <Link href={`/events/${(ev as any).$id}`} className="text-sm underline hover:no-underline">View details</Link>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

