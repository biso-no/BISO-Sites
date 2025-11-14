import { listEvents } from '@/app/actions/events'
import { getLocale } from '@/app/actions/locale'
import { EventsClient } from './events-client'
import type { AdminEvent } from '@/lib/types/event'
import type { Locale, ContentTranslations } from '@repo/api/types/appwrite'
import { pickTranslation } from '@/lib/utils/content-translations'

const mapEventsToClient = (events: AdminEvent[], locale: Locale): ContentTranslations[] =>
  events
    .map((event) => {
      const translation = pickTranslation(event, locale)
      if (!translation) return null

      return {
        ...translation,
        $id: translation.$id ?? `${event.$id}-${translation.locale ?? locale}`,
        content_id: event.$id,
        event_ref: {
          image: event.image,
          start_date: event.start_date ?? event.metadata_parsed?.start_date ?? null,
          end_date: event.end_date ?? event.metadata_parsed?.end_date ?? null,
          location: event.location ?? event.metadata_parsed?.location ?? null,
          metadata: event.metadata_parsed ?? {},
        },
      } as ContentTranslations
    })
    .filter((item): item is ContentTranslations => Boolean(item))

export async function EventsSection() {
  const locale = await getLocale();
  
  const events = await listEvents({
    status: 'published',
    limit: 4,
  });

  return <EventsClient events={mapEventsToClient(events, locale)} />;
}

