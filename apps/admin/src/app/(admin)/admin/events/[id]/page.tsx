import { notFound } from 'next/navigation'
import { getEvent } from '@/app/actions/events'
import EventEditor from '../shared/EventEditor'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const event = await getEvent(id)
  console.log("Event: ", event);
  
  if (!event) {
    notFound()
  }
  
  return <EventEditor event={event} />
}
