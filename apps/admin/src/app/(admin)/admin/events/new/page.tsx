import EventEditor from '../shared/EventEditor'
import { listCampuses, listDepartments } from '@/app/actions/events'

export default async function NewEventPage() {
  const [campuses, departments] = await Promise.all([
    listCampuses(),
    listDepartments(),
  ])
  return <EventEditor campuses={campuses as any} departments={departments as any} />
}
