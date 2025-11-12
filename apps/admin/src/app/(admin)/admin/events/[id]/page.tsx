import { getEvent, listCampuses, listDepartments } from '@/app/actions/events'
import EventEditor from '../shared/EventEditor'

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [event, campuses, departments] = await Promise.all([
    getEvent(id),
    listCampuses(),
    listDepartments(),
  ])
  return <EventEditor event={event as any} campuses={campuses as any} departments={departments as any} />
}
