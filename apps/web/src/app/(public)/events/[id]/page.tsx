import { getEvent, getEventImageViewUrl } from '@/app/actions/events'
import { getLocale } from '@/app/actions/locale'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { PublicPageHeader } from '@/components/public/PublicPageHeader'

export default async function PublicEventDetail({ params }: { 
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  
  // Get user's preferred locale from their account preferences
  const locale = await getLocale()
  const event = await getEvent(id, locale)
  
  if (!event) return notFound()
  if ((event as any).status && (event as any).status !== 'published') {
    return notFound()
  }

  const imageUrl = event.image ? await getEventImageViewUrl(event.image) : null

  return (
    <div className="space-y-6">
      <PublicPageHeader
        title={event.title}
        subtitle={[
          new Date(event.start_date).toLocaleDateString(), 
          event.end_date ? `– ${new Date(event.end_date).toLocaleDateString()}` : '', 
          event.campus?.name || event.campus_id,
          event.location
        ].filter(Boolean).join(' • ')}
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Events', href: '/events' }, { label: event.title }]}
      />
      {imageUrl && (
        <div className="relative w-full h-64 rounded-lg overflow-hidden">
          <Image src={imageUrl} alt={event.title} fill className="object-cover" />
        </div>
      )}
      <article className="prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: event.description || '' }} />
      
      <div className="flex flex-wrap gap-4">
        {event.ticket_url && (
          <a href={event.ticket_url} target="_blank" rel="noreferrer" className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
            Get Tickets
          </a>
        )}
        {event.price && (
          <span className="inline-flex items-center px-4 py-2 bg-muted rounded-md">
            Price: {event.price} NOK
          </span>
        )}
      </div>
    </div>
  )
}

