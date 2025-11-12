import { listEvents } from '@/app/actions/events';
import { getLocale } from '@/app/actions/locale';
import { EventsClient } from './events-client';

export async function EventsSection() {
  const locale = await getLocale();
  
  const events = await listEvents({
    locale,
    status: 'published',
    limit: 4,
  });

  return <EventsClient events={events} />;
}

