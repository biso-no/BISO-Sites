import { notFound } from "next/navigation";
import { requireNavAccess } from "@/lib/authorization";
import { listAttendees, listSegments } from "../../../_actions/event-segments";
import { getEvent } from "../../../_actions/events";
import { SegmentsStudio } from "./_components/segments-studio";

interface SegmentsPageProps {
  params: Promise<{ id: string }>;
}

export default async function EventSegmentsPage({ params }: SegmentsPageProps) {
  await requireNavAccess("portal.events");
  const { id } = await params;

  const event = await getEvent(id);
  if (!event) {
    notFound();
  }

  const [segments, attendees] = await Promise.all([
    listSegments(id),
    listAttendees(id),
  ]);

  const enTitle =
    event.translation_refs.find((row) => row.locale === "en")?.title ??
    event.translation_refs[0]?.title ??
    event.slug ??
    "Event";

  return (
    <SegmentsStudio
      attendees={attendees}
      campusId={event.campus_id ?? null}
      eventId={id}
      eventTitle={enTitle}
      segments={segments}
    />
  );
}
